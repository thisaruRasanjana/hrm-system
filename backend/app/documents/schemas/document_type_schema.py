from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional


class DocumentTypeCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_mandatory: bool = False


class DocumentTypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_mandatory: Optional[bool] = None
    is_active: Optional[bool] = None


class DocumentTypeResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    is_mandatory: bool
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
