"""
documents/models/audit_log_model.py
=====================================
ORM model for the document_audit_logs table.

WHY audit logging: A production HR system must be able to answer "who changed
the status of this request, and when?" for compliance and dispute resolution.
Every status transition on a DocumentRequest writes one row here.

This table is append-only — rows are never updated or deleted.
"""

import uuid

from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database.base import Base


class DocumentAuditLog(Base):
    """Immutable record of a single status change on a DocumentRequest."""

    __tablename__ = "document_audit_logs"

    # UUID primary key for the log entry itself
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # The request that was changed (soft FK — no hard constraint to keep it simple)
    request_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    # Employee ID of the HR user who made the change (nullable for system/email actions)
    changed_by_employee_id = Column(Integer, nullable=True)

    # Status values stored as plain strings for readability without enum dependency
    old_status = Column(String(30), nullable=True)
    new_status = Column(String(30), nullable=False)

    # Optional note explaining the change (e.g., rejection reason snippet)
    note = Column(String(500), nullable=True)

    # Auto-set at insert time — this column is never updated
    changed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
