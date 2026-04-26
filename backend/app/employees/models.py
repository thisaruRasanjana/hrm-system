from sqlalchemy import Column, String, Integer, Date, Enum, Text
from app.database.base import Base
import enum
from sqlalchemy.dialects.postgresql import ARRAY


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
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(20), nullable=True)
    marital_status = Column(String(20), nullable=True)
    nationality = Column(String(100), nullable=True)
    roles = Column(ARRAY(String), default=["employee"])
