from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional, List

class LeaveRequestCreate(BaseModel):
    leave_type_id: int
    start_date: date
    end_date: date
    half_day: bool = False
    reason: Optional[str] = None
    attachment_urls: Optional[List[str]] = [] #if you have file upload later

class AssignLeaveRequestCreate(LeaveRequestCreate):
    employee_id: int

class LeaveRequestOut(BaseModel):
    leave_request_id: int
    employee_id: int
    leave_type_id: int
    leave_type_name: Optional[str]= None
    start_date: date
    end_date: date
    total_days: float
    half_day: bool
    status: str
    reason: Optional[str]
    attachment_urls: Optional[List[str]] = []
    rejection_reason: Optional[str]
    manager_comment: Optional[str]= None #new added 29/03
    approved_by: Optional[int]
    approved_date: Optional[date]
    assigned_by: Optional[int] = None  # set when HR assigned this leave on the employee's behalf
    # Requesting employee's display fields (populated for approver views)
    employee_name: Optional[str] = None
    employee_code: Optional[str] = None
    department: Optional[str] = None
    role: Optional[str] = None
    parent_request_id: Optional[int] = None
    approved_by_name: Optional[str] = None

    class Config:
        from_attributes = True

class LeaveStatusUpdate(BaseModel):
    status: str  # APPROVED / REJECTED / REQ_INFO / PENDING
    rejection_reason: Optional[str] = None  # only needed if REJECTED

class ApproveLeaveRequest(BaseModel):
    manager_comment: Optional[str] = None
    approved_leave_type_id: Optional[int] = None


class RejectLeaveRequest(BaseModel):
    rejection_reason: str


class RequestInfoLeaveRequest(BaseModel):
    manager_comment: str

class ResubmitLeaveRequest(BaseModel):
    attachment_urls: Optional[List[str]] = []
    reason: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    half_day: Optional[bool] = None

class CancelLeaveRequest(BaseModel):
    reason: Optional[str] = None

class RequestMedicalLeave(BaseModel):
    manager_comment: Optional[str] = None

class LeaveTypeCreate(BaseModel):
    name: str
    description: Optional[str] = None

class LeaveTypeOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    default_days: Optional[float] = None
    directly_requestable: bool = True

    class Config:
        from_attributes = True


class LeaveBalanceOut(BaseModel):
    leave_type_id: int
    leave_type_name: str
    entitlement: Optional[float] = None   # None = unlimited
    used_days: float
    pending_days: float
    remaining: Optional[float] = None     # None = unlimited


class EntitlementItem(BaseModel):
    role_id: int
    leave_type_id: int
    days: Optional[float] = None          # None = remove override (fall back to type default)


class EntitlementEntry(BaseModel):
    role_id: int
    role_name: str
    leave_type_id: int
    leave_type_name: str
    days: Optional[float] = None
    is_override: bool


class EntitlementRole(BaseModel):
    id: int
    name: str


class EntitlementLeaveType(BaseModel):
    id: int
    name: str
    default_days: Optional[float] = None


class EntitlementMatrixOut(BaseModel):
    roles: List[EntitlementRole]
    leave_types: List[EntitlementLeaveType]
    entries: List[EntitlementEntry]


class EmployeeEntitlementItem(BaseModel):
    leave_type_id: int
    days: Optional[float] = None


class EmployeeEntitlementEntry(BaseModel):
    leave_type_id: int
    leave_type_name: str
    days: Optional[float] = None
    is_override: bool


class EmployeeEntitlementOut(BaseModel):
    employee_id: int
    employee_name: str
    leave_types: List[EntitlementLeaveType]
    entries: List[EmployeeEntitlementEntry]


class MedicalConversionCreate(BaseModel):
    start_date: date
    end_date: date
    attachment_urls: Optional[List[str]] = []
    reason: Optional[str] = None


class MedicalConversionOut(BaseModel):
    id: int
    leave_request_id: int
    employee_id: int
    employee_name: Optional[str] = None
    start_date: date
    end_date: date
    attachment_urls: Optional[List[str]] = []
    reason: Optional[str]
    status: str
    reviewer_id: Optional[int]
    reviewer_comment: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class MedicalConversionReview(BaseModel):
    reviewer_comment: Optional[str] = None

class LeaveAuditLogOut(BaseModel):
    id: int
    leave_request_id: int
    changed_by_employee_id: Optional[int]
    old_status: Optional[str]
    new_status: str
    note: Optional[str]
    changed_at: datetime

    class Config:
        from_attributes = True
