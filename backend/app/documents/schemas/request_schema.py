"""
documents/schemas/request_schema.py
======================================
Pydantic schemas for document request creation and API responses.

WHY validation: Without Field validators, an empty string or a 10 000-character
reason would silently pass into the database. Explicit limits make the API
self-documenting and protect storage.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field
from typing import Optional

from app.documents.models.request_model import RequestStatus
from app.documents.constants import REASON_MAX_LENGTH


class CreateRequestInput(BaseModel):
    """Frontend-facing input: only document_type and reason; employee_id is resolved server-side."""

    document_type: str = Field(
        ...,
        min_length=2,
        max_length=150,
        description="The type of document being requested",
    )
    reason: str = Field(
        ...,
        min_length=5,
        max_length=REASON_MAX_LENGTH,
        description="Why this document is needed",
    )


class CreateRequest(BaseModel):
    """Internal schema used by the service; employee_id is always set by the router."""

    employee_id: int = Field(..., gt=0, description="Must be a positive employee ID")
    document_type: str = Field(
        ...,
        min_length=2,
        max_length=150,
        description="The type of document being requested",
    )
    reason: str = Field(
        ...,
        min_length=5,
        max_length=REASON_MAX_LENGTH,
        description="Why this document is needed",
    )


class RequestResponse(BaseModel):
    """Response schema returned for any document request endpoint."""

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