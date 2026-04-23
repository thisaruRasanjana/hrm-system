from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from typing import List, Optional
import os

from app.database.session import get_db
from app.core.deps import get_current_user
from app.auth.models import User
from app.notifications.models import Notification
from app.notifications.schemas import NotificationCreate, NotificationResponse

router = APIRouter()


# ── GET my notifications ───────────────────────────────────────────────────────
@router.get("/", response_model=List[NotificationResponse])
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns all notifications for current_user.id only, newest first"""
    return (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )


# ── GET recent notifications ──────────────────────────────────────────────────
@router.get("/recent", response_model=List[NotificationResponse])
def get_recent(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns 5 most recent unread notifications for dashboard widget"""
    return (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(5)
        .all()
    )


# ── PUT mark single notification as read ──────────────────────────────────────
@router.put("/{notification_id}/read", response_model=NotificationResponse)
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notif = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return notif


# ── PUT mark ALL notifications as read ────────────────────────────────────────
@router.put("/read-all", status_code=status.HTTP_200_OK)
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read"}


# ── POST /internal — API Key required — for other modules to push notifications ──
@router.post("/internal", status_code=status.HTTP_201_CREATED)
def internal_push(
    data: NotificationCreate,
    db: Session = Depends(get_db),
    x_internal_key: Optional[str] = Header(None)
):
    """
    Internal endpoint for other modules to trigger notifications.
    Requires X-Internal-Key header.
    """
    internal_key = os.getenv("INTERNAL_API_KEY", "hrm-internal-2024")
    if x_internal_key != internal_key:
        raise HTTPException(status_code=403, detail="Invalid internal key")

    notif = Notification(
        user_id=data.user_id,
        message=data.message,
        type=data.type,
        link=data.link
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return {"id": notif.id, "status": "delivered"}

