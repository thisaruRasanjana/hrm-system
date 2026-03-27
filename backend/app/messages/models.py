from sqlalchemy import Column, Integer, String, Text, DateTime
from datetime import datetime, timezone
from app.database.base import Base

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_name = Column(String, nullable=False)
    sender_role = Column(String, nullable=False)
    target_group = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    is_deleted = Column(Integer, default=0) # Using Integer (0/1) for SQLite compatibility with Boolean
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
