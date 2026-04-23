from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class CreateRequest(BaseModel):
    employee_id: int
    document_type: str
    reason: str


from typing import Optional

from app.documents.models.request_model import RequestStatus

class RequestResponse(BaseModel):
    id: UUID
    employee_id: Optional[int] = None
    employee_name: Optional[str] = None
    document_type: str
    reason: str
    status: RequestStatus
    source: str = "INTERNAL"
    requester_email: Optional[str] = None
    created_at: datetime
    rejection_reason: Optional[str] = None
    generated_document_path: Optional[str] = None

    class Config:
        from_attributes = True