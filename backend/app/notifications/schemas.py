from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class NotificationCreate(BaseModel):
    user_id: int
    message: str
    type: str = "info"
    link: Optional[str] = None
    category: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    message: str
    type: str
    link: Optional[str] = None
    is_read: bool
    created_at: Optional[datetime] = None
    category: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    is_archived: bool = False
    is_deleted: bool = False

    class Config:
        from_attributes = True


class NotificationBulkAction(BaseModel):
    """
    Payload for bulk inbox actions (archive / delete / restore / read).

    ``ids`` is capped so a single request can't be used to scan the table.
    Only the caller's own notifications are ever touched — enforced in the router.
    """

    ids: List[int] = Field(..., min_length=1, max_length=500)


class NotificationCounts(BaseModel):
    """Per-folder counts used to render the sidebar badges."""

    inbox: int
    unread: int
    archived: int
    trash: int
