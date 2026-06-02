from sqlalchemy import Column, String, Integer, Boolean, DateTime, func, Table, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database.base import Base
from app.roles.models import user_roles  # noqa: F401 — ensures table is registered


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=True)
    password_hash = Column("hashed_password", String(255), nullable=False)  # DB col: hashed_password
    is_active = Column(Boolean, default=True)
    is_superadmin = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    refresh_token = Column(String, nullable=True)

    # Role & Position (string kept for backward compat; role_id is the authoritative FK)
    role = Column(String, default="employee")
    position = Column(String, nullable=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)

    # Profile Fields
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    employee_id = Column(String, unique=True, nullable=True)
    department = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    address = Column(String, nullable=True)
    date_of_birth = Column(String, nullable=True)
    emergency_contact_number = Column(String, nullable=True)
    profile_image_url = Column(String, nullable=True)

    # 2FA
    two_factor_enabled = Column(Boolean, default=False)
    totp_secret = Column(String, nullable=True)

    # Notification preferences
    notification_preferences = Column(JSONB, nullable=True)
    quiet_hours_start = Column(String, default="22:00")
    quiet_hours_end = Column(String, default="08:00")

    # Relationships (RBAC via join table — from dev)
    roles = relationship("Role", secondary=user_roles, back_populates="users")
    employee = relationship("Employee", back_populates="user", uselist=False)

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False) # 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT'
    ip_address = Column(String, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User")

class OTPRecord(Base):
    __tablename__ = "otp_records"
    id = Column(Integer, primary_key=True)
    email = Column(String, nullable=False, index=True)
    otp = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
