"""
documents/models/model.py
==========================
ORM model for the employee_documents table.

Design decisions:
- String columns have explicit max lengths to enforce data integrity at the
  database level and prevent runaway storage from bad input.
- 'reviewed_by' stores an integer FK to the employees table (soft reference,
  no hard FK constraint, to avoid circular dependency issues at migration time).
- 'rejection_reason' uses Text because rejection notes can be arbitrarily long.
"""

import enum
import uuid

from sqlalchemy import Boolean, Column, DateTime, Enum, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database.base import Base


class DocumentStatus(enum.Enum):
    """Lifecycle states for a submitted employee document."""

    UPLOADED = "UPLOADED"
    PENDING_REVIEW = "PENDING_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class EmployeeDocument(Base):
    """Represents a document uploaded by an employee for HR review."""

    __tablename__ = "employee_documents"

    # Primary key — UUID to avoid enumerable IDs in download URLs
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Employee who uploaded the document
    employee_id = Column(Integer, nullable=False)

    # Human-readable document type name (e.g. "National ID", "CV")
    document_type = Column(String(150), nullable=False)

    # Whether this document is mandatory for the employee's profile
    is_mandatory = Column(Boolean, default=False)

    # Original filename and server path, bounded to prevent overflow
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)

    # Review lifecycle status
    status = Column(
        Enum(DocumentStatus),
        default=DocumentStatus.PENDING_REVIEW,
        nullable=False,
    )

    # Timestamp of upload
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    # HR reviewer details (soft reference — no hard FK to allow flexibility)
    reviewed_by = Column(Integer, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    # Free-text rejection note; Text used because length is unbounded
    rejection_reason = Column(Text, nullable=True)