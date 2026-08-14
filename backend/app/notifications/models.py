from sqlalchemy import Column, Integer, String, Boolean, DateTime, func, ForeignKey
from app.database.base import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(String, nullable=False)
    type = Column(String, default="info")           # info, success, warning, error
    link = Column(String, nullable=True)            # optional navigation link
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())

    # ── Added for notification system ──────────────────────────────────────
    category = Column(String, nullable=True)        # leave, document, recruitment, announcement, holiday, events, celebration, security, system
    entity_type = Column(String, nullable=True)     # e.g. "leave_request", "document", "vacancy"
    entity_id = Column(String, nullable=True)       # ID of the related entity (string for UUID compat)

    # ── Inbox foldering (email-style: Inbox / Archived / Trash) ────────────
    # A notification is in exactly one folder:
    #   is_deleted  → Trash   (restorable until purged)
    #   is_archived → Archived
    #   neither     → Inbox
    # Trash wins over Archived so deleting an archived item moves it to Trash.
    is_archived = Column(Boolean, default=False, nullable=False, server_default="false")
    archived_at = Column(DateTime, nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False, server_default="false")
    deleted_at = Column(DateTime, nullable=True)
