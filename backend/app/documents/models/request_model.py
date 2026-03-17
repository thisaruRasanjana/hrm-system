from sqlalchemy import Column, String, Enum, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
import enum

from app.database.base import Base


class RequestStatus(enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class DocumentRequest(Base):
    __tablename__ = "document_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    employee_id = Column(UUID(as_uuid=True), nullable=False)

    document_type = Column(String, nullable=False)
    purpose = Column(String, nullable=False)

    status = Column(Enum(RequestStatus), default=RequestStatus.PENDING)

    created_at = Column(DateTime(timezone=True), server_default=func.now())