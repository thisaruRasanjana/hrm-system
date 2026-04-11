from pydantic import BaseModel, EmailStr
from datetime import date
from typing import Optional
from enum import Enum

class EmployeeStatus(str, Enum):
    active = "active"
    inactive = "inactive"

class EmployeeBase(BaseModel):
    employee_id: str
    first_name: str
    last_name: str
    email: EmailStr
    phone: str
    address: Optional[str] = None
    department: str
    designation: str
    joined_date: Optional[date] = None
    status: EmployeeStatus = EmployeeStatus.active

class EmployeeCreate(EmployeeBase):
    pass

class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    joined_date: Optional[date] = None
    status: Optional[EmployeeStatus] = None

class EmployeeOut(EmployeeBase):
    id: int

    class Config:
        from_attributes = True
