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
    directly_requestable = Column(Boolean, nullable=False, server_default="true", default=True)


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

    # NULL = self-requested. Set to the assigning HR's Employee.id when a leave
    # is created on an employee's behalf via /leave/assign. Such requests need
    # HR/Admin approval (not the assigner, not a Manager).
    assigned_by = Column(Integer, nullable=True)

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
    parent_request_id = Column(Integer, ForeignKey("leave_requests.leave_request_id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class EmployeeLeaveEntitlement(Base):
    """Per-employee annual entitlement for a leave type.

    Overrides both LeaveEntitlement (per-role) and LeaveType.default_days for specific employees.
    """
    __tablename__ = "employee_leave_entitlements"
    __table_args__ = (
        UniqueConstraint("employee_id", "leave_type_id", name="uix_employee_leave_type"),
    )

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    leave_type_id = Column(Integer, ForeignKey("leave_types.id", ondelete="CASCADE"), nullable=False)
    days = Column(Float, nullable=False)


class LeaveMedicalConversion(Base):
    __tablename__ = "leave_medical_conversions"

    id = Column(Integer, primary_key=True, index=True)
    leave_request_id = Column(Integer, ForeignKey("leave_requests.leave_request_id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(Integer, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    attachment_urls = Column(JSON, nullable=True)
    reason = Column(Text, nullable=True)
    status = Column(String(20), default="PENDING")  # PENDING / APPROVED / REJECTED
    reviewer_id = Column(Integer, nullable=True)
    reviewer_comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class LeaveAuditLog(Base):
    __tablename__ = "leave_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    leave_request_id = Column(Integer, ForeignKey("leave_requests.leave_request_id", ondelete="CASCADE"), nullable=False)
    changed_by_employee_id = Column(Integer, nullable=True)   # None = system
    old_status = Column(String(30), nullable=True)
    new_status = Column(String(30), nullable=False)
    note = Column(Text, nullable=True)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())