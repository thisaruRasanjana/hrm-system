from sqlalchemy import Column, Integer, String, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB
from app.database.base import Base


class Role(Base):
    """
    Shared role table.
    - You own the schema and API.
    - Teammate's Role Creation UI calls POST /roles/ with the permissions[] array.
    - Permissions must use the exact strings defined in app/core/permissions.py
    """
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    permissions = Column(JSONB, nullable=False, default=list)  # list of permission strings
    created_by = Column(Integer, nullable=True)                # user_id who created this role
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
