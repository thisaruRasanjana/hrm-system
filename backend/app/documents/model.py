from sqlalchemy import Column, String, Enum, DateTime, ForeignKey, Boolean
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

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    employee_id = Column(UUID(as_uuid=True), nullable=False)

    document_type = Column(String, nullable=False)
    is_mandatory = Column(Boolean, default=False)

    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)

    status = Column(Enum(DocumentStatus), default=DocumentStatus.PENDING_REVIEW)

    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
