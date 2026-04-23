from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class NotificationCreate(BaseModel):
    user_id: int
    message: str
    type: str = "info"
    link: Optional[str] = None


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    message: str
    type: str
    link: Optional[str] = None
    is_read: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
