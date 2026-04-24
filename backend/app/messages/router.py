from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from app.database.database import get_db
from app.core.deps import get_current_user
from app.auth.models import User
from app.messages import models, schemas

router = APIRouter()


# ── POST send message ───────────────────────────────────────────────────────────
@router.post("/", response_model=schemas.MessageResponse)
def send_message(
    message: schemas.MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Roles that can send messages (match exact DB values)
    SENDER_ROLES = {"Admin", "HR Manager", "Manager", "super_admin", "hr", "manager"}
    if current_user.role not in SENDER_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to send messages"
        )

    # Create Message record
    db_message = models.Message(
        sender_id=current_user.id,
        subject=message.subject,
        content=message.content,
        target_group=message.target_group,
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)

    # Determine recipients based on target_group
    recipients_query = db.query(User)
    if message.target_group == "All Employees":
        # Everyone except admin/hr
        recipients_query = recipients_query.filter(User.role == "Employee")
    elif message.target_group in ("HR", "HR Manager"):
        recipients_query = recipients_query.filter(User.role == "HR Manager")
    elif message.target_group == "All":
        pass  # All users
    else:
        # Specific department name
        recipients_query = recipients_query.filter(User.department == message.target_group)

    # Create MessageRecipient record for EACH recipient — but NOT for the sender
    recipients = recipients_query.all()
    for recipient in recipients:
        if recipient.id == current_user.id:
            continue
        db_recipient = models.MessageRecipient(
            message_id=db_message.id,
            recipient_id=recipient.id
        )
        db.add(db_recipient)
    
    db.commit()
    
    return {
        **db_message.__dict__,
        "sender_name": f"{current_user.first_name} {current_user.last_name}".strip() or current_user.email,
        "is_read": False,
        "is_deleted": False,
        "sender_deleted": False
    }


# ── GET inbox ───────────────────────────────────────────────────────────────────
@router.get("/inbox", response_model=List[schemas.MessageResponse])
def get_inbox(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    results = (
        db.query(models.Message, models.MessageRecipient, User)
        .join(models.MessageRecipient, models.Message.id == models.MessageRecipient.message_id)
        .join(User, models.Message.sender_id == User.id)
        .filter(
            models.MessageRecipient.recipient_id == current_user.id,
            models.MessageRecipient.is_deleted == False,
            models.MessageRecipient.is_permanent_deleted == False
        )
        .order_by(models.Message.created_at.desc())
        .all()
    )

    messages = []
    for msg, rec, sender in results:
        messages.append({
            **msg.__dict__,
            "sender_name": f"{sender.first_name} {sender.last_name}".strip() or sender.email,
            "is_read": rec.is_read,
            "is_deleted": rec.is_deleted,
            "sender_deleted": msg.sender_deleted
        })
    return messages


# ── GET sent ────────────────────────────────────────────────────────────────────
@router.get("/sent", response_model=List[schemas.MessageResponse])
def get_sent(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    results = (
        db.query(models.Message)
        .filter(
            models.Message.sender_id == current_user.id,
            models.Message.sender_deleted == False
        )
        .order_by(models.Message.created_at.desc())
        .all()
    )
    
    messages = []
    for msg in results:
        messages.append({
            **msg.__dict__,
            "sender_name": "Me",
            "is_read": True,
            "is_deleted": False,
            "sender_deleted": msg.sender_deleted
        })
    return messages


# ── GET trash ───────────────────────────────────────────────────────────────────
@router.get("/trash", response_model=List[schemas.MessageResponse])
def get_trash(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Inbox trash
    inbox_trash = (
        db.query(models.Message, models.MessageRecipient, User)
        .join(models.MessageRecipient, models.Message.id == models.MessageRecipient.message_id)
        .join(User, models.Message.sender_id == User.id)
        .filter(
            models.MessageRecipient.recipient_id == current_user.id,
            models.MessageRecipient.is_deleted == True,
            models.MessageRecipient.is_permanent_deleted == False
        )
        .all()
    )

    # Sent trash
    sent_trash = (
        db.query(models.Message)
        .filter(
            models.Message.sender_id == current_user.id,
            models.Message.sender_deleted == True
        )
        .all()
    )

    messages = []
    for msg, rec, sender in inbox_trash:
        messages.append({
            **msg.__dict__,
            "sender_name": f"{sender.first_name} {sender.last_name}".strip() or sender.email,
            "is_read": rec.is_read,
            "is_deleted": rec.is_deleted,
            "sender_deleted": msg.sender_deleted
        })
    
    for msg in sent_trash:
        messages.append({
            **msg.__dict__,
            "sender_name": "Me",
            "is_read": True,
            "is_deleted": True,
            "sender_deleted": True
        })
    
    return sorted(messages, key=lambda x: x["created_at"], reverse=True)


# ── PUT delete (soft delete) ─────────────────────────────────────────────────────
@router.put("/{message_id}/delete")
def delete_message(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check if in inbox
    recipient_rec = db.query(models.MessageRecipient).filter(
        models.MessageRecipient.message_id == message_id,
        models.MessageRecipient.recipient_id == current_user.id
    ).first()

    if recipient_rec:
        recipient_rec.is_deleted = True
        recipient_rec.deleted_at = datetime.now(timezone.utc)
    
    # Check if in sent
    message_rec = db.query(models.Message).filter(
        models.Message.id == message_id,
        models.Message.sender_id == current_user.id
    ).first()

    if message_rec:
        message_rec.sender_deleted = True

    if not recipient_rec and not message_rec:
        raise HTTPException(status_code=404, detail="Message not found")

    db.commit()
    return {"message": "Message moved to trash"}


# ── PUT restore ─────────────────────────────────────────────────────────────────
@router.put("/{message_id}/restore")
def restore_message(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recipient_rec = db.query(models.MessageRecipient).filter(
        models.MessageRecipient.message_id == message_id,
        models.MessageRecipient.recipient_id == current_user.id
    ).first()

    if recipient_rec:
        recipient_rec.is_deleted = False
        recipient_rec.deleted_at = None
    
    message_rec = db.query(models.Message).filter(
        models.Message.id == message_id,
        models.Message.sender_id == current_user.id
    ).first()

    if message_rec:
        message_rec.sender_deleted = False

    db.commit()
    return {"message": "Message restored"}


# ── DELETE permanent ────────────────────────────────────────────────────────────
@router.delete("/{message_id}/permanent")
def permanent_delete(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recipient_rec = db.query(models.MessageRecipient).filter(
        models.MessageRecipient.message_id == message_id,
        models.MessageRecipient.recipient_id == current_user.id,
        models.MessageRecipient.is_deleted == True
    ).first()

    if recipient_rec:
        recipient_rec.is_permanent_deleted = True
        db.commit()
        return {"message": "Message permanently deleted from inbox"}
    
    # If sender and in trash, we could delete the record if no other recipients have it?
    # But for simplicity, we'll just keep the Message record if recipients still have it.
    # The requirement says "Set MessageRecipient.is_permanent_deleted = True"
    
    raise HTTPException(status_code=400, detail="Only deleted inbox messages can be permanently deleted via this endpoint")


# ── PUT read ────────────────────────────────────────────────────────────────────
@router.put("/{message_id}/read")
def mark_read(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recipient_rec = db.query(models.MessageRecipient).filter(
        models.MessageRecipient.message_id == message_id,
        models.MessageRecipient.recipient_id == current_user.id
    ).first()

    if not recipient_rec:
        raise HTTPException(status_code=404, detail="Message not found in inbox")

    recipient_rec.is_read = True
    db.commit()
    return {"message": "Message marked as read"}
