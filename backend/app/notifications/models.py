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
