from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from app.database.base import Base


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    event_date = Column(DateTime, nullable=False)
    location = Column(String, nullable=True)
    created_by = Column(Integer, nullable=False)  # user_id FK
    created_at = Column(DateTime, default=func.now())


class UserCalendarEvent(Base):
    """Association table for events users have explicitly added to their personal dashboard calendar."""
    __tablename__ = "user_calendar_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=func.now())
