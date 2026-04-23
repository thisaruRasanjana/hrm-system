from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class RoleCreate(BaseModel):
    name: str
    permissions: List[str] = []


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    permissions: Optional[List[str]] = None


class RoleResponse(BaseModel):
    id: int
    name: str
    permissions: List[str]
    created_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True
