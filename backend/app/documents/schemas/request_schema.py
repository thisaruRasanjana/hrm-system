from datetime import datetime
from typing import Optional
from uuid import UUID

from app.documents.models.request_model import RequestStatus
from pydantic import BaseModel


class CreateRequest(BaseModel):
    employee_id: int
    document_type: str
    reason: str


class RequestResponse(BaseModel):
    id: UUID
    employee_id: Optional[int] = None
    employee_name: Optional[str] = None
    document_type: str
    reason: str
    purpose: Optional[str] = None
    status: RequestStatus
    source: str = "INTERNAL"
    requester_email: Optional[str] = None
    created_at: datetime
    rejection_reason: Optional[str] = None
    generated_document_path: Optional[str] = None

    class Config:
        from_attributes = True
