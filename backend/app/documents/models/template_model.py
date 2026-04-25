from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.database.base import Base


class DocumentTemplate(Base):
    __tablename__ = "document_templates"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)

    # HTML | DOCX | PDF
    template_type = Column(String(20), nullable=False)

    # Used when template_type = HTML
    content = Column(Text, nullable=True)

    # Used when template_type = DOCX or PDF
    file_path = Column(String(500), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())