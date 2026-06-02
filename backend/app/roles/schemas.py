from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class PermissionOut(BaseModel):
    id: int
    permission_name: str
    resource: Optional[str] = None
    action: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class RoleCreate(BaseModel):
    role_name: str
    description: Optional[str] = None
    permission_ids: List[int] = []


class RoleUpdate(BaseModel):
    role_name: Optional[str] = None
    description: Optional[str] = None
    permission_ids: Optional[List[int]] = None


class RoleOut(BaseModel):
    id: int
    role_name: str
    description: Optional[str] = None
    created_at: datetime
    permissions: List[PermissionOut] = []

    model_config = {"from_attributes": True}


class AssignRoleRequest(BaseModel):
    user_id: int
    role_ids: List[int]
