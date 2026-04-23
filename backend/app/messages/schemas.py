from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class MessageCreate(BaseModel):
    """Client only sends target_group, subject, content. Sender info comes from JWT."""
    target_group: str
    subject: str
    content: str


class MessageUpdate(BaseModel):
    subject: str
    content: str


class MessageResponse(BaseModel):
    id: int
    sender_id: int
    sender_name: Optional[str] = None
    subject: Optional[str] = None
    content: str
    target_group: Optional[str] = None
    is_read: bool = False
    is_deleted: bool = False
    sender_deleted: bool = False
    created_at: datetime

    class Config:
        from_attributes = True
