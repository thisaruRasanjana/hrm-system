"""
documents/models/document_type_model.py
=========================================
ORM model for the document_types table.

DocumentType acts as the master catalogue of document categories that
employees can upload or request. HR manages this list.

Design decisions:
- 'name' is capped at String(150) to match the same limit used in
  EmployeeDocument.document_type, ensuring consistent enforcement.
- 'category' separates the upload catalogue ("My Documents") from the request
  catalogue ("Request Document") so both can be managed from one admin tab.
- 'is_active' allows soft-deletion — deactivated types are hidden from
  employees but retained in historical records.
"""

import uuid

from sqlalchemy import Boolean, Column, DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database.base import Base


class DocumentType(Base):
    """Master catalogue entry for a type of HR document."""

    __tablename__ = "document_types"

    # UUID primary key for non-enumerable IDs
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Unique human-readable name, length matches EmployeeDocument.document_type
    name = Column(String(150), nullable=False, unique=True)

    # Which catalogue this entry belongs to:
    #   'UPLOAD'  — types employees can upload under "My Documents"
    #   'REQUEST' — types employees can request under "Request Document"
    # Kept on one table (instead of a second model) so the same admin tooling,
    # service layer, and API serve both lists. server_default backfills existing
    # rows as upload types when the column is added to a live DB.
    category = Column(String(20), nullable=False, default="UPLOAD", server_default="UPLOAD")

    # Optional longer description for HR reference
    description = Column(Text, nullable=True)

    # True = employees must upload this document type before approval
    is_mandatory = Column(Boolean, default=False, nullable=False)

    # False = soft-deleted; hidden from employee-facing lists
    is_active = Column(Boolean, default=True, nullable=False)

    # Auto-set on creation; used for ordering in admin lists
    created_at = Column(DateTime(timezone=True), server_default=func.now())
