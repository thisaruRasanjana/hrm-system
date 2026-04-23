from pydantic import BaseModel, EmailStr
from typing import Optional, List


class UserResponse(BaseModel):
    id: int
    email: str
    username: Optional[str] = None
    is_active: bool
    role: str = 'employee'
    role_id: Optional[int] = None
    position: Optional[str] = None
    permissions: List[str] = []        # ← resolved from role_id → Role.permissions
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    employee_id: Optional[str] = None
    department: Optional[str] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    date_of_birth: Optional[str] = None
    emergency_contact_number: Optional[str] = None
    profile_image_url: Optional[str] = None
    two_factor_enabled: Optional[bool] = False
    notification_preferences: Optional[dict] = None
    quiet_hours_start: Optional[str] = '22:00'
    quiet_hours_end: Optional[str] = '08:00'

    class Config:
        from_attributes = True


class UserProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    date_of_birth: Optional[str] = None
    emergency_contact_number: Optional[str] = None


class UserPasswordUpdate(BaseModel):
    current_password: str
    new_password: str


class UserNotificationUpdate(BaseModel):
    notification_preferences: dict
    quiet_hours_start: str
    quiet_hours_end: str


class LoginRequest(BaseModel):
    """Accepts either email or username in the `email` field, or the dedicated `username` field."""
    email: Optional[str] = None        # can be email or username
    username: Optional[str] = None
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"