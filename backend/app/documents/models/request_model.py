"""
documents/models/request_model.py
===================================
ORM model for the document_requests table.

Supports both INTERNAL requests (raised by employees through the portal)
and EXTERNAL requests (parsed from inbound emails by the email poller).

Design decisions:
- 'reason' uses Text because the request description can be arbitrarily long.
- 'rejection_reason' also uses Text for the same reason.
- 'source' is capped at String(20) since only 'INTERNAL'/'EXTERNAL' are valid.
- 'requester_email' is String(255) — the RFC 5321 maximum email address length.
- 'document_type' is String(150) — consistent with the DocumentType name limit.
"""

import enum
import uuid

from sqlalchemy import Column, DateTime, Enum, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database.base import Base


class RequestStatus(enum.Enum):
    """Lifecycle states for a document request."""

    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    APPROVED = "APPROVED"
    COMPLETED = "COMPLETED"
    REJECTED = "REJECTED"


class DocumentRequest(Base):
    """Represents a request for a generated HR document (letter, certificate, etc.)."""

    __tablename__ = "document_requests"

    # UUID primary key — avoids sequential ID guessing on download URLs
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Nullable to allow external (email-sourced) requests with no portal user
    employee_id = Column(Integer, nullable=True)

    # 'INTERNAL' = submitted via portal, 'EXTERNAL' = parsed from inbound email
    source = Column(String(20), default="INTERNAL", nullable=False)

    # Email address of the person who sent an external email request
    requester_email = Column(String(255), nullable=True)

    # Human-readable document type (e.g. "Service Letter", "Salary Confirmation")
    document_type = Column(String(150), nullable=False)

    # Why the document is needed; Text allows arbitrarily long explanations
    reason = Column(Text, nullable=False)

    # Current lifecycle state of the request
    status = Column(Enum(RequestStatus), default=RequestStatus.PENDING, nullable=False)

    # Populated when HR rejects the request; Text for unconstrained length
    rejection_reason = Column(Text, nullable=True)

    # Path to the generated PDF/DOCX file, once the request is completed
    generated_document_path = Column(String(500), nullable=True)

    # Auto-set to the current timestamp on creation
    created_at = Column(DateTime(timezone=True), server_default=func.now())