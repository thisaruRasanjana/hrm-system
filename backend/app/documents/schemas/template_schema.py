"""
documents/schemas/template_schema.py
======================================
Pydantic schemas for document template management.
"""

from datetime import datetime
from typing import Optional
from enum import Enum

from pydantic import BaseModel, Field, field_validator

from app.core.storage_service import storage


class TemplateTypeEnum(str, Enum):
    """Supported template formats."""
    HTML = "HTML"
    DOCX = "DOCX"
    PDF = "PDF"


class TemplateCreate(BaseModel):
    """Input schema for creating a new document template."""
    name: str = Field(..., min_length=2, max_length=255, description="Template name")
    category: str = Field(..., min_length=2, max_length=100, description="Template category")
    template_type: str = Field(..., description="Template format (HTML, DOCX, PDF)")
    content: Optional[str] = None


class TemplateUpdate(BaseModel):
    """Input schema for updating an existing document template."""
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    category: Optional[str] = Field(None, min_length=2, max_length=100)
    template_type: Optional[str] = None
    content: Optional[str] = None


class TemplateResponse(BaseModel):
    """Response schema returned for template endpoints."""
    id: int
    name: str
    category: str
    template_type: str
    content: Optional[str] = None
    file_path: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

    @field_validator("file_path")
    @classmethod
    def _resolve_file_url(cls, v: Optional[str]) -> Optional[str]:
        """Convert the stored storage key into a ready-to-use URL.

        Local backend → "/uploads/...", S3 backend → presigned URL. The frontend
        can then fetch/preview it directly (via the fileUrl() helper) without
        knowing the storage layout.
        """
        return storage.get_url(v) if v else None