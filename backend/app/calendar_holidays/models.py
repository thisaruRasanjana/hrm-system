from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from app.database.base import Base

class Holiday(Base):
    __tablename__ = "holidays"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    date = Column(String, nullable=False)  # YYYY-MM-DD
    is_mercantile = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
