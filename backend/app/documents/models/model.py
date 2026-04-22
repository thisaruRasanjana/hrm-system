from sqlalchemy import Column, String, Enum, DateTime, Boolean, Text, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
import enum

from app.database.base import Base


class DocumentStatus(enum.Enum):
    UPLOADED = "UPLOADED"
    PENDING_REVIEW = "PENDING_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class EmployeeDocument(Base):
    __tablename__ = "employee_documents"

    # Primary ID
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Employee who uploaded the document
    employee_id = Column(Integer, nullable=False)

    # Document type (NIC, Passport, Certificates, etc.)
    document_type = Column(String, nullable=False)

    # Whether document is mandatory for employee profile
    is_mandatory = Column(Boolean, default=False)

    # File details
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)

    # Document review status
    status = Column(
        Enum(DocumentStatus),
        default=DocumentStatus.PENDING_REVIEW,
        nullable=False
    )

    # Upload time
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    # Review details (HR / Manager approval)
    reviewed_by = Column(Integer, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    # Reason if document rejected
    rejection_reason = Column(Text, nullable=True)