from sqlalchemy import Column, String, Integer, Date, Enum, Text, ForeignKey, Boolean
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
    phone = Column(String(20), nullable=False)
    address = Column(Text, nullable=True)

    # Department is now a FK to departments table
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    department_rel = relationship("Department", back_populates="employees")

    designation = Column(String(100), nullable=False)
    joined_date = Column(Date, nullable=True)
    status = Column(Enum(EmployeeStatus, name="employeestatus", create_type=False), default=EmployeeStatus.active)
    is_deleted = Column(Boolean, default=False)

    # Personal Information
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(20), nullable=True)
    marital_status = Column(String(20), nullable=True)
    nationality = Column(String(100), nullable=True)

    # Emergency Contact
    emergency_contact_name = Column(String(100), nullable=True)
    emergency_contact_phone = Column(String(20), nullable=True)
    emergency_contact_relation = Column(String(50), nullable=True)

    # Skills & Qualifications
    skills = Column(Text, nullable=True)
    qualifications = Column(Text, nullable=True)

    # Bank Details
    bank_name = Column(String(100), nullable=True)
    bank_account_no = Column(String(50), nullable=True)
    bank_branch = Column(String(100), nullable=True)

    # User FK — roles live on User, not Employee
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    user = relationship("User", back_populates="employee")
