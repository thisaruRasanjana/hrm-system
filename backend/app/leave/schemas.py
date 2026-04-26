"""
app/leave/schemas.py
--------------------
Pydantic request/response schemas for the leave module.

WHY validators are here (not in the router):
  FastAPI runs Pydantic validation before the route handler executes, so
  invalid payloads are rejected with a structured 422 response automatically —
  no manual if-checks required in the router or service.
"""

from pydantic import BaseModel, ConfigDict, field_validator, model_validator
from datetime import date
from typing import Optional, List


class LeaveRequestCreate(BaseModel):
    """Payload for submitting or editing a leave request."""

    leave_type_id:   int
    start_date:      date
    end_date:        date
    half_day:        bool = False
    reason:          Optional[str] = None
    attachment_urls: Optional[List[str]] = []

    @field_validator("leave_type_id")
    @classmethod
    def leave_type_must_be_positive(cls, v: int) -> int:
        """Leave type ID must reference a real DB row — 0 or negative is invalid."""
        if v <= 0:
            raise ValueError("leave_type_id must be a positive integer")
        return v

    @field_validator("reason")
    @classmethod
    def reason_not_blank(cls, v: Optional[str]) -> Optional[str]:
        """Reject whitespace-only reasons early."""
        if v is not None and not v.strip():
            raise ValueError("reason cannot be blank")
        return v

    @model_validator(mode="after")
    def end_must_be_gte_start(self) -> "LeaveRequestCreate":
        """end_date must not precede start_date."""
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date cannot be before start_date")
        return self


class LeaveRequestOut(BaseModel):
    """Response schema returned for any leave request."""

    leave_request_id: int
    employee_id:      int
    leave_type_id:    int
    leave_type_name:  Optional[str] = None
    start_date:       date
    end_date:         date
    total_days:       float
    half_day:         bool
    status:           str
    reason:           Optional[str] = None
    attachment_urls:  Optional[List[str]] = []
    rejection_reason: Optional[str] = None
    manager_comment:  Optional[str] = None
    approved_by:      Optional[int] = None
    approved_by_name: Optional[str] = None
    approved_date:    Optional[date] = None

    # Denormalised fields populated by service queries (joined from Employee).
    employee_name:  Optional[str] = None
    employee_code:  Optional[str] = None
    department:     Optional[str] = None
    role:           Optional[str] = None

    # Allow ORM model instances to be passed directly (Pydantic V2 style).
    model_config = ConfigDict(from_attributes=True)


class LeaveStatusUpdate(BaseModel):
    """Generic status-change payload (legacy endpoint — prefer specific ones below)."""

    status:           str
    rejection_reason: Optional[str] = None

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, v: str) -> str:
        allowed = {"APPROVED", "REJECTED", "REQ_INFO", "PENDING"}
        if v.upper() not in allowed:
            raise ValueError(f"status must be one of {allowed}")
        return v.upper()


class ApproveLeaveRequest(BaseModel):
    """Payload for the approve endpoint."""
    manager_comment: Optional[str] = None


class RejectLeaveRequest(BaseModel):
    """Payload for the reject endpoint. rejection_reason is mandatory."""
    rejection_reason: str

    @field_validator("rejection_reason")
    @classmethod
    def reason_not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("rejection_reason cannot be blank")
        return v.strip()


class RequestInfoLeaveRequest(BaseModel):
    """Payload for the request-info endpoint. manager_comment is mandatory."""
    manager_comment: str

    @field_validator("manager_comment")
    @classmethod
    def comment_not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("manager_comment cannot be blank")
        return v.strip()


class ResubmitLeaveRequest(BaseModel):
    """Payload for the employee resubmission endpoint."""
    attachment_urls: Optional[List[str]] = []
    reason:          Optional[str] = None


class LeaveTypeCreate(BaseModel):
    """Payload for creating a new leave type."""
    name:        str
    description: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Leave type name cannot be blank")
        return v.strip()


class LeaveTypeOut(BaseModel):
    """Response schema for a leave type."""
    id:          int
    name:        str
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)