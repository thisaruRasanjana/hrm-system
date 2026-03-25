from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class CreateRequest(BaseModel):
    employee_id: UUID
    document_type: str
    purpose: str


from typing import Optional

from app.documents.models.request_model import RequestStatus

class RequestResponse(BaseModel):
    id: UUID
    document_type: str
    purpose: str
    status: RequestStatus
    created_at: datetime
    rejection_reason: Optional[str] = None
    generated_document_path: Optional[str] = None

    class Config:
        from_attributes = True