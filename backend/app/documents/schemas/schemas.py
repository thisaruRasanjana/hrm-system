from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class DocumentUploadResponse(BaseModel):
    id: UUID
    document_type: str
    status: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


class EmployeeDocumentResponse(BaseModel):
    id: UUID
    employee_id: int
    document_type: str
    is_mandatory: bool
    status: str
    uploaded_at: datetime
    rejection_reason: str | None = None

    class Config:
        from_attributes = True