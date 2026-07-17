"""
documents/schemas/employee_docs_schema.py
=========================================
Pydantic schemas for the HR "Employee Documents" browser.

Lets authorized users (document:view_employee_docs) browse any active or
inactive employee's uploaded documents and document requests — not just the
ones sitting in the pending-approval queue.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel

from app.documents.models.request_model import RequestStatus


class EmployeeDocsSummary(BaseModel):
    """One row in the employee browser list, with document counts."""

    id: int
    employee_id: Optional[str] = None
    first_name: str
    last_name: str
    department: Optional[str] = None
    designation: Optional[str] = None
    status: str
    uploaded_count: int = 0
    request_count: int = 0

    class Config:
        from_attributes = True


class EmployeeUploadedDocument(BaseModel):
    """An uploaded document as shown to HR (any lifecycle status)."""

    id: UUID
    document_type: str
    is_mandatory: bool
    file_name: str
    # Ready-to-use URL (local: /uploads/..., S3: presigned), never a raw storage key
    file_url: Optional[str] = None
    status: str
    uploaded_at: datetime
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None


class EmployeeRequestedDocument(BaseModel):
    """A document request raised by/for the employee, with the generated file if completed."""

    id: UUID
    document_type: str
    reason: str
    status: RequestStatus
    source: str = "INTERNAL"
    created_at: datetime
    rejection_reason: Optional[str] = None
    generated_document_url: Optional[str] = None


class EmployeeDocsDetail(BaseModel):
    """Full per-employee payload: profile header plus both document lists."""

    employee: EmployeeDocsSummary
    uploaded_documents: list[EmployeeUploadedDocument]
    requested_documents: list[EmployeeRequestedDocument]
