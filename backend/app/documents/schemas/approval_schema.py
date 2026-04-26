"""
documents/schemas/approval_schema.py
====================================
Pydantic schemas for the document approval workflows.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.documents.constants import REJECTION_REASON_MIN_LENGTH


class DocumentApprovalResponse(BaseModel):
    """Response schema for an employee document awaiting/after approval."""
    id: UUID
    employee_id: int
    employee_name: str = "Unknown Employee"
    document_type: str
    file_name: str
    file_path: str
    status: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


class RejectDocumentRequest(BaseModel):
    """Input schema when rejecting an uploaded employee document."""
    reason: str = Field(
        ...,
        min_length=REJECTION_REASON_MIN_LENGTH,
        description="Reason for rejecting the document (must be clear to the employee)"
    )