"""
documents/schemas/document_type_schema.py
=========================================
Pydantic schemas for document type management.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.documents.constants import DOCUMENT_TYPE_NAME_MAX_LENGTH


class DocumentTypeCreate(BaseModel):
    """Input schema for creating a new document type."""
    name: str = Field(
        ...,
        min_length=1,
        max_length=DOCUMENT_TYPE_NAME_MAX_LENGTH,
        description="The name of the document type (e.g. 'National ID', 'CV')"
    )
    description: Optional[str] = Field(None, max_length=500)
    is_mandatory: bool = False


class DocumentTypeUpdate(BaseModel):
    """Input schema for updating an existing document type."""
    name: Optional[str] = Field(None, min_length=1, max_length=DOCUMENT_TYPE_NAME_MAX_LENGTH)
    description: Optional[str] = Field(None, max_length=500)
    is_mandatory: Optional[bool] = None
    is_active: Optional[bool] = None


class DocumentTypeResponse(BaseModel):
    """Response schema for document type endpoints."""
    id: UUID
    name: str
    description: Optional[str] = None
    is_mandatory: bool
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
