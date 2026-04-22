from pydantic import BaseModel
from typing import List, Optional

class PermissionBase(BaseModel):
    name: str
    description: Optional[str] = None

class PermissionRead(PermissionBase):
    id: int

    class Config:
        from_attributes = True

class RoleBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_system: int = 0

class RoleRead(RoleBase):
    id: int
    permissions: List[PermissionRead] = []

    class Config:
        from_attributes = True

class RoleCreate(RoleBase):
    permissions: List[str] # List of permission names

class RoleUpdate(BaseModel):
    permissions: List[str] # List of permission names

class RoleAssignment(BaseModel):
    employee_id: int
    role_id: int
