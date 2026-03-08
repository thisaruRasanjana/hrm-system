from sqlalchemy import Column, Integer, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime

from app.database.base import Base


class DashboardLayout(Base):
    __tablename__ = "dashboard_layouts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    layout = Column(JSONB, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow)