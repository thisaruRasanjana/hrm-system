from pydantic import BaseModel
from typing import List
from uuid import UUID
from datetime import datetime

class DocumentUploadResponse(BaseModel):
    id: UUID
    document_type: str
    status: str
    uploaded_at: datetime

    class Config:
        orm_mode = True

class EmployeeDocumentResponse(BaseModel):
    id: UUID
    document_type: str
    is_mandatory: bool
    status: str
    uploaded_at: datetime

    class Config:
        orm_mode = True
