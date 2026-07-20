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
    # Original uploaded filename so the employee can identify each row (BUG-04).
    file_name: str | None = None
    is_mandatory: bool
    status: str
    uploaded_at: datetime
    # Review outcome — populated once HR approves/rejects (BUG-17).
    reviewed_by: int | None = None
    reviewed_by_name: str | None = None
    reviewed_at: datetime | None = None
    rejection_reason: str | None = None

    class Config:
        from_attributes = True