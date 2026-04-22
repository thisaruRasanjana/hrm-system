from sqlalchemy import Column, String, Integer, Table, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database.base import Base

# Association table for Many-to-Many relationship between Roles and Permissions
role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", Integer, ForeignKey("roles.id"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id"), primary_key=True)
)

class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False) # e.g. "employee:view"
    description = Column(String(255), nullable=True)

class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False) # e.g. "HR Manager"
    description = Column(String(255), nullable=True)
    is_system = Column(Integer, default=0) # 1 for built-in, 0 for custom

    permissions = relationship("Permission", secondary=role_permissions, back_populates="roles")
    # employees relationship is configured from Employee side via backref

Permission.roles = relationship("Role", secondary=role_permissions, back_populates="permissions")
