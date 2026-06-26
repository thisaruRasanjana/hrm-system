"""
documents/schemas/hr_request_schema.py
======================================
Pydantic schemas for HR operations on document requests.
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.documents.models.request_model import RequestStatus


class HRRequestStatusUpdate(BaseModel):
    """Input schema for HR to approve, reject, or complete a request."""
    status: RequestStatus = Field(..., description="The target status (e.g. APPROVED, REJECTED)")
    rejection_reason: Optional[str] = Field(None, description="Required if status is REJECTED")


class HRGenerateDocumentRequest(BaseModel):
    """Input schema for triggering document generation from a template."""
    template_id: int = Field(..., description="ID of the DocumentTemplate to use")
    preview: Optional[bool] = Field(False, description="If true, returns HTML preview without saving")
    override_reason: Optional[str] = Field(None, description="Optional custom reason to embed in the letter")


class HRCustomLetterRequest(BaseModel):
    """Input schema for generating a letter from raw HTML.

    Used both for free-form custom letters and for sending an edited preview
    (where HR tweaked the generated text before issuing it).
    """
    content: str = Field(..., description="The letter body as HTML")
    preserve_whitespace: bool = Field(
        True,
        description="True for plain typed text (keeps line breaks); False for rich HTML such as an edited template preview",
    )


class HRRequestResponse(BaseModel):
    """Response schema for a document request viewed by HR."""
    id: UUID
    employee_id: Optional[int] = None
    employee_name: Optional[str] = "External Request"
    document_type: str
    reason: str  # Note: Previously called 'purpose', aligned with DB model
    status: RequestStatus
    source: str = "INTERNAL"
    requester_email: Optional[str] = None
    requester_message: Optional[str] = None
    rejection_reason: Optional[str] = None
    generated_document_path: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class HRGetRequestsResponse(BaseModel):
    data: List[HRRequestResponse]
