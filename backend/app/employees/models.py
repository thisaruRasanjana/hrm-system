from sqlalchemy import Column, String, Integer, Date, Enum, Text
from app.database.base import Base
import enum

class EmployeeStatus(enum.Enum):
    active = "active"
    inactive = "inactive"

class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), unique=True, index=True) # e.g. #EMP-001
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(20), nullable=False)
    address = Column(Text, nullable=True)
    department = Column(String(100), nullable=False)
    designation = Column(String(100), nullable=False)
    joined_date = Column(Date, nullable=True)
    status = Column(Enum(EmployeeStatus), default=EmployeeStatus.active)
