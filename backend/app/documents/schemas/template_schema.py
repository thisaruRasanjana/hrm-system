from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TemplateCreate(BaseModel):
    name: str
    category: str
    template_type: str
    content: Optional[str] = None


class TemplateUpdate(BaseModel):
    name: Optional[str]
    category: Optional[str]
    template_type: Optional[str]
    content: Optional[str]


class TemplateResponse(BaseModel):
    id: int
    name: str
    category: str
    template_type: str
    content: Optional[str]
    file_path: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True