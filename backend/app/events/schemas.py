from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    event_date: datetime
    location: Optional[str] = None


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    event_date: Optional[datetime] = None
    location: Optional[str] = None


class EventResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    event_date: datetime
    location: Optional[str] = None
    created_by: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EventWithStatus(EventResponse):
    is_saved: bool = False
