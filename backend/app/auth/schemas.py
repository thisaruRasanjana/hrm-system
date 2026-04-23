from pydantic import BaseModel, EmailStr
from typing import Optional, List


class UserMe(BaseModel):
    id: int
    username: str
    email: str
    roles: List[str]
    permissions: List[str]
    features: dict = {}  # For future feature flags

    model_config = {"from_attributes": True}


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    is_active: bool

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: Optional[int] = None


class UserPermissionsOut(BaseModel):
    user_id: int
    permissions: List[str]
