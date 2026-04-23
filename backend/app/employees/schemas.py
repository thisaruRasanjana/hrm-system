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
    department_id: Optional[int] = None   # Optional in base for out/legacy
    designation: str
    joined_date: Optional[date] = None
    status: EmployeeStatus = EmployeeStatus.active
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None
    nationality: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    skills: Optional[str] = None
    qualifications: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_branch: Optional[str] = None


class EmployeeCreate(EmployeeBase):
    department_id: int  # Required for creation
    role_id: int  # Required for unified creation


class EmployeeUpdate(BaseModel):
    employee_id: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    department_id: Optional[int] = None
    designation: Optional[str] = None
    joined_date: Optional[date] = None
    status: Optional[EmployeeStatus] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None
    nationality: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    skills: Optional[str] = None
    qualifications: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_branch: Optional[str] = None


class RoleInfo(BaseModel):
    id: int
    role_name: str
    model_config = {"from_attributes": True}


class DepartmentInfo(BaseModel):
    id: int
    name: str
    model_config = {"from_attributes": True}


class EmployeeOut(EmployeeBase):
    id: int
    user_id: Optional[int] = None
    role: Optional[RoleInfo] = None
    department_rel: Optional[DepartmentInfo] = None

    model_config = {"from_attributes": True}
