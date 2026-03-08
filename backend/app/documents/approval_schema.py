from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional


class DocumentApprovalResponse(BaseModel):
    id: UUID
    employee_id: UUID
    document_type: str
    file_name: str
    file_path: str
    status: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


class RejectDocumentRequest(BaseModel):
    reason: str