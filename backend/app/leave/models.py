from sqlalchemy import Column, Integer, String, Date, Float, Text, DateTime, Boolean, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.sql import func
from app.database.base import Base
from sqlalchemy import JSON

class LeaveType(Base):
    __tablename__ = "leave_types"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False, unique=True)
    description = Column(String(255), nullable=True)
    # Fallback annual entitlement in days when no per-role entitlement is set;
    # NULL = unlimited (no balance enforcement)
    default_days = Column(Float, nullable=True)


class LeaveEntitlement(Base):
    """Per-role annual entitlement for a leave type.

    Overrides LeaveType.default_days for users holding that role, so
    HR/Super Admin can grant e.g. Managers more annual leave than Employees.
    """
    __tablename__ = "leave_entitlements"
    __table_args__ = (
        UniqueConstraint("role_id", "leave_type_id", name="uix_role_leave_type"),
    )

    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    leave_type_id = Column(Integer, ForeignKey("leave_types.id", ondelete="CASCADE"), nullable=False)
    days = Column(Float, nullable=False)

class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    leave_request_id = Column(Integer, primary_key=True, index=True)

    employee_id = Column(Integer, nullable=False)          # later FK to employees.id
    leave_type_id = Column(Integer, ForeignKey("leave_types.id"), nullable=False)

    approved_by = Column(Integer, nullable=True)           # later FK to employees.id

    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)

    total_days = Column(Float, nullable=False)
    half_day = Column(Boolean, default=False)

    status = Column(String(20), default="PENDING")

    reason = Column(Text, nullable=True)
    attachment_urls = Column(JSON, nullable=True)  #new added 
    rejection_reason = Column(Text, nullable=True)

    manager_comment = Column(Text, nullable=True) #new added 29/03

    approved_date = Column(Date, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())