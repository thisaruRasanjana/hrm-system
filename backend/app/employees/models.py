from sqlalchemy import Column, String, Integer, Date, Enum, Text, ForeignKey, Boolean, JSON, func
from sqlalchemy.orm import relationship
from app.database.base import Base
import enum


class EmployeeStatus(enum.Enum):
    active = "active"
    inactive = "inactive"


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), unique=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)

    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    department_rel = relationship("Department", back_populates="employees")

    designation_id = Column(Integer, ForeignKey("designations.id"), nullable=True)
    designation = Column(String(100), nullable=True)
    joined_date = Column(Date, nullable=True)
    status = Column(Enum(EmployeeStatus, name="employeestatus", create_type=False), default=EmployeeStatus.active)
    is_deleted = Column(Boolean, default=False)

    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(20), nullable=True)
    marital_status = Column(String(20), nullable=True)
    nationality = Column(String(100), nullable=True)

    emergency_contact_name = Column(String(100), nullable=True)
    emergency_contact_phone = Column(String(20), nullable=True)
    emergency_contact_relation = Column(String(50), nullable=True)

    skills = Column(Text, nullable=True)
    qualifications = Column(Text, nullable=True)

    bank_name = Column(String(100), nullable=True)
    bank_account_no = Column(String(50), nullable=True)
    bank_branch = Column(String(100), nullable=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, unique=True)
    user = relationship("User", back_populates="employee")

    designation_history = relationship("EmployeeDesignationHistory", back_populates="employee", cascade="all, delete-orphan")


class EmployeeDesignationHistory(Base):
    __tablename__ = "employee_designation_history"

    id               = Column(Integer, primary_key=True, index=True)
    employee_id      = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    designation_id   = Column(Integer, ForeignKey("designations.id", ondelete="SET NULL"), nullable=True)
    designation_name = Column(String(100), nullable=False)
    start_date       = Column(Date, nullable=False)
    end_date         = Column(Date, nullable=True)
    promotion_letter_sent = Column(Boolean, default=False, nullable=False)
    
    # Optional per-employee leave day overrides for this designation period
    # Stored as: [{"leave_type_id": 1, "days": 14}, ...]
    leave_overrides  = Column(JSON, nullable=True)
    
    from sqlalchemy import DateTime
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    employee = relationship("Employee", back_populates="designation_history")
