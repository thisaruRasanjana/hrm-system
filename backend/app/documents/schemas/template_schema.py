"""
documents/schemas/template_schema.py
======================================
Pydantic schemas for document template management.
"""

from datetime import datetime
from typing import Optional
from enum import Enum

from pydantic import BaseModel, Field


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