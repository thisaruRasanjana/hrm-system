from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database.database import get_db
from app.core.deps import get_current_user, require_permission
from app.auth.models import User
from app.announcements.models import Announcement
from app.announcements.schemas import AnnouncementCreate, AnnouncementUpdate, AnnouncementResponse

router = APIRouter()


# ── GET all (any authenticated user with view permission) ──────────────────────
@router.get("", response_model=List[AnnouncementResponse])
def list_announcements(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """All authenticated users can read announcements."""
    return db.query(Announcement).order_by(Announcement.created_at.desc()).all()


# ── POST — requires widget.announcements.manage ────────────────────────────────
@router.post("", response_model=AnnouncementResponse, status_code=status.HTTP_201_CREATED)
def create_announcement(
    data: AnnouncementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("widget.announcements.manage")),
):
    ann = Announcement(
        title=data.title,
        content=data.content,
        created_by=current_user.id,
    )
    db.add(ann)
    db.commit()
    db.refresh(ann)

    # ── Notify everyone ──────────────────────────────────────────────
    try:
        # Get all active user IDs
        active_user_ids = [uid for (uid,) in db.query(User.id).filter(User.is_active == True).all()]
        if active_user_ids:
            from app.notifications.service import notify_users
            notify_users(
                db, active_user_ids,
                f"New announcement: {ann.title}",
                category="announcement", type="info", link="/dashboard#widget-announcements",
                entity_type="announcement", entity_id=str(ann.id),
            )
            db.commit()
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"[Announcements] Notification failed: {e}")

    return ann


# ── PUT — requires widget.announcements.manage ────────────────────────────────
@router.put("/{announcement_id}", response_model=AnnouncementResponse)
def update_announcement(
    announcement_id: int,
    data: AnnouncementUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("widget.announcements.manage")),
):
    ann = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    if data.title is not None:
        ann.title = data.title
    if data.content is not None:
        ann.content = data.content
    db.commit()
    db.refresh(ann)
    return ann


# ── DELETE — requires widget.announcements.manage ─────────────────────────────
@router.delete("/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("widget.announcements.manage")),
):
    ann = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    db.delete(ann)
    db.commit()
