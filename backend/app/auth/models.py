from sqlalchemy import Column, String, Integer, DateTime, func, Table, ForeignKey
from sqlalchemy.orm import relationship
from app.database.base import Base
from app.roles.models import user_roles  # noqa: F401 — ensures table is registered


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    roles = relationship("Role", secondary=user_roles, back_populates="users")
    employee = relationship("Employee", back_populates="user", uselist=False)
