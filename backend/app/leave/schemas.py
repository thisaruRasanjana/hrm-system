from pydantic import BaseModel
from datetime import date
from typing import Optional, List

class LeaveRequestCreate(BaseModel):
    leave_type_id: int
    start_date: date
    end_date: date
    half_day: bool = False
    reason: Optional[str] = None
    attachment_urls: Optional[List[str]] = [] #if you have file upload later

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

    class Config:
        from_attributes = True

class LeaveStatusUpdate(BaseModel):
    status: str  # APPROVED / REJECTED / REQ_INFO / PENDING
    rejection_reason: Optional[str] = None  # only needed if REJECTED

class ApproveLeaveRequest(BaseModel):
    manager_comment: Optional[str] = None


class RejectLeaveRequest(BaseModel):
    rejection_reason: str


class RequestInfoLeaveRequest(BaseModel):
    manager_comment: str

class ResubmitLeaveRequest(BaseModel):
    attachment_urls: Optional[List[str]] = []
    reason: Optional[str] = None

class LeaveTypeCreate(BaseModel):
    name: str
    description: Optional[str] = None

class LeaveTypeOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    default_days: Optional[float] = None

    class Config:
        from_attributes = True


class LeaveBalanceOut(BaseModel):
    leave_type_id: int
    leave_type_name: str
    entitlement: Optional[float] = None   # None = unlimited
    used_days: float
    pending_days: float
    remaining: Optional[float] = None     # None = unlimited