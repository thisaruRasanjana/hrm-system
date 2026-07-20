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

from sqlalchemy import Column, DateTime, Enum, Index, Integer, String, Text, text
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

    # Partial unique index: one DocumentRequest per inbound email. Partial because
    # INTERNAL (portal) requests have no Message-ID, and those NULLs must not collide.
    __table_args__ = (
        Index(
            "ix_document_requests_source_message_id",
            "source_message_id",
            unique=True,
            postgresql_where=text("source_message_id IS NOT NULL"),
        ),
    )

    # UUID primary key — avoids sequential ID guessing on download URLs
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Nullable to allow external (email-sourced) requests with no portal user
    employee_id = Column(Integer, nullable=True)

    # 'INTERNAL' = submitted via portal, 'EXTERNAL' = parsed from inbound email
    source = Column(String(20), default="INTERNAL", nullable=False)

    # Email address of the person who sent an external email request
    requester_email = Column(String(255), nullable=True)

    # RFC 5322 Message-ID of the inbound email this request was imported from.
    # This — not the IMAP \Seen flag — is the authoritative "already imported"
    # ledger. \Seen is shared mutable state: anyone opening the mailbox in a mail
    # client clears it, which silently hid inbound requests from the poller.
    # Uniqueness is enforced in the database (see __table_args__), not just by the
    # poller's pre-check: that check is a read-then-write, so two pollers racing
    # can both read "not imported" and both insert.
    source_message_id = Column(String(255), nullable=True)

    # Full body of the inbound email (external requests only). Lets HR read the
    # actual context — e.g. which employee the letter is about — since the system
    # does not auto-extract that. Text: email bodies can be arbitrarily long.
    requester_message = Column(Text, nullable=True)

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