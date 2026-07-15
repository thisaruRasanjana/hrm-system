from pydantic import BaseModel, EmailStr, model_validator
from datetime import date
from typing import Optional, Any, List
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
    department_id: Optional[int] = None
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


class EmployeeLeaveEntitlementCreate(BaseModel):
    leave_type_id: int
    days: float


class AccrualRuleCreate(BaseModel):
    """Monthly leave accrual rule set when adding/editing an employee."""
    leave_type_id: int
    days_per_month: float


class EmployeeCreate(EmployeeBase):
    department_id: int
    role_id: int
    designation_id: Optional[int] = None
    designation_start_date: Optional[date] = None
    designation_end_date: Optional[date] = None
    designation_leave_overrides: Optional[List[EmployeeLeaveEntitlementCreate]] = None
    designation_accrual_rules: Optional[List[AccrualRuleCreate]] = None


class EmployeeUpdate(BaseModel):
    employee_id: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    department_id: Optional[int] = None
    designation: Optional[str] = None
    designation_id: Optional[int] = None
    designation_start_date: Optional[date] = None
    designation_end_date: Optional[date] = None
    designation_leave_overrides: Optional[List[EmployeeLeaveEntitlementCreate]] = None
    designation_accrual_rules: Optional[List[AccrualRuleCreate]] = None
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


from datetime import datetime

class DesignationHistoryEntry(BaseModel):
    id: int
    designation_id: Optional[int] = None
    designation_name: str
    start_date: date
    end_date: Optional[date] = None
    promotion_letter_sent: bool = False
    leave_overrides: Optional[List[dict]] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class EmployeeOut(EmployeeBase):
    id: int
    user_id: Optional[int] = None
    role: Optional[RoleInfo] = None
    department_rel: Optional[DepartmentInfo] = None
    
    designation_id: Optional[int] = None
    designation_history: Optional[List[DesignationHistoryEntry]] = []

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def resolve_role(cls, data: Any) -> Any:
        """Resolve role from the linked user's roles relationship."""
        if hasattr(data, "user") and data.user:
            user = data.user
            if hasattr(user, "roles") and user.roles:
                top_role = user.roles[0]
                data.__dict__["role"] = {"id": top_role.id, "role_name": top_role.role_name}
            elif hasattr(user, "role_id") and user.role_id:
                data.__dict__["role"] = {"id": user.role_id, "role_name": user.role or "Unknown"}
        return data


# ── Recruitment-compatible minimal schemas (used by recruitment module) ─────────

class EmployeePanelOption(BaseModel):
    """Minimal employee view for interview panel dropdowns."""
    id: int
    employee_id: Optional[str] = None
    first_name: str
    last_name: str
    designation: Optional[str] = None
    department_name: Optional[str] = None
    has_leave_override: Optional[bool] = False

    model_config = {"from_attributes": True}

    @classmethod
    def from_employee(cls, emp: Any) -> "EmployeePanelOption":
        dept_name = None
        if hasattr(emp, "department_rel") and emp.department_rel:
            dept_name = emp.department_rel.name
        return cls(
            id=emp.id,
            employee_id=emp.employee_id,
            first_name=emp.first_name,
            last_name=emp.last_name,
            designation=emp.designation,
            department_name=dept_name,
            has_leave_override=getattr(emp, "has_leave_override", False),
        )
