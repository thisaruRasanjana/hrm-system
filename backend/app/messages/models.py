from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from datetime import datetime, timezone
from app.database.base import Base


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject = Column(String, nullable=True)
    content = Column(Text, nullable=False)
    target_group = Column(String, nullable=True)  # "All Employees", "HR", or specific department
    sender_deleted = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class MessageRecipient(Base):
    __tablename__ = "message_recipients"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_read = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)   # moved to trash
    is_permanent_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)
