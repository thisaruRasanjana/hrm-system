from sqlalchemy import Column, String, Integer, Date, Enum, Text, ForeignKey
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
    department = Column(String(100), nullable=False)
    designation = Column(String(100), nullable=False)
    joined_date = Column(Date, nullable=True)
    status = Column(Enum(EmployeeStatus), default=EmployeeStatus.active)

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

    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    role = relationship("Role", backref="employees", foreign_keys=[role_id])

# Deferred import to avoid circular import — ensures Role is in the mapper registry
# when Employee.role relationship is configured by SQLAlchemy
from app.auth import models as _auth_models  # noqa: F401, E402
