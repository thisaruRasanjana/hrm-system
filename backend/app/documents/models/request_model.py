from sqlalchemy import Column, String, Enum, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
import enum

from app.database.base import Base


class RequestStatus(enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    APPROVED = "APPROVED"
    COMPLETED = "COMPLETED"
    REJECTED = "REJECTED"


class DocumentRequest(Base):
    __tablename__ = "document_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    employee_id = Column(UUID(as_uuid=True), nullable=True) # Allowed to be null for external requests
    source = Column(String, default="INTERNAL")             # "INTERNAL" or "EXTERNAL"
    requester_email = Column(String, nullable=True)         # Tracking the external sender's email

    document_type = Column(String, nullable=False)
    purpose = Column(String, nullable=False)

    status = Column(Enum(RequestStatus), default=RequestStatus.PENDING)

    rejection_reason = Column(String, nullable=True)
    generated_document_path = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())