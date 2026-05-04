from pydantic import BaseModel, EmailStr, model_validator
from datetime import date
from typing import Optional, Any
from enum import Enum


class EmployeeStatus(str, Enum):
    active = "active"
    inactive = "inactive"


class EmployeeBase(BaseModel):
    employee_id: Optional[str] = None
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None
    department_id: Optional[int] = None   # Optional in base for out/legacy
    designation: Optional[str] = None
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
    email: Optional[str] = None
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

    @model_validator(mode="before")
    @classmethod
    def resolve_role(cls, data: Any) -> Any:
        """Resolve role from the linked user's roles relationship."""
        if hasattr(data, "user") and data.user:
            user = data.user
            # Prefer many-to-many roles list
            if hasattr(user, "roles") and user.roles:
                top_role = user.roles[0]
                data.__dict__["role"] = {"id": top_role.id, "role_name": top_role.role_name}
            elif hasattr(user, "role_id") and user.role_id:
                # Fallback: construct partial RoleInfo from flat fields
                data.__dict__["role"] = {"id": user.role_id, "role_name": user.role or "Unknown"}
        return data
