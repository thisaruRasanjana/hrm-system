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
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None
    nationality: Optional[str] = None

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
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None
    nationality: Optional[str] = None

class RoleInfo(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True

class EmployeeOut(EmployeeBase):
    id: int
    role: Optional[RoleInfo] = None

    class Config:
        from_attributes = True
