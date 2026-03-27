from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.documents.models.request_model import RequestStatus

class HRRequestStatusUpdate(BaseModel):
    status: RequestStatus
    rejection_reason: Optional[str] = None

class HRGenerateDocumentRequest(BaseModel):
    template_id: int
    preview: Optional[bool] = False

class HRRequestResponse(BaseModel):
    id: UUID
    employee_id: Optional[UUID] = None
    employee_name: Optional[str] = "External Request"
    document_type: str
    purpose: str
    status: RequestStatus
    source: str = "INTERNAL"
    requester_email: Optional[str] = None
    rejection_reason: Optional[str] = None
    generated_document_path: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class HRGetRequestsResponse(BaseModel):
    data: List[HRRequestResponse]
