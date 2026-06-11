from pydantic import BaseModel
from datetime import date
from typing import Optional, List


class LeaveReportRow(BaseModel):
    leave_request_id: int
    employee_id: int
    employee_code: Optional[str] = None
    employee_name: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    joined_date: Optional[date] = None
    employee_status: Optional[str] = None
    leave_type_id: int
    leave_type_name: Optional[str] = None
    start_date: date
    end_date: date
    total_days: float
    half_day: bool
    status: str
    reason: Optional[str] = None
    approved_by: Optional[int] = None
    approved_date: Optional[date] = None
    rejection_reason: Optional[str] = None
    manager_comment: Optional[str] = None


class LeaveReportSummary(BaseModel):
    total_requests: int
    total_leave_days: float
    approved_requests: int
    pending_requests: int
    rejected_requests: int
    req_info_requests: int


class LeaveReportResponse(BaseModel):
    summary: LeaveReportSummary
    records: List[LeaveReportRow]