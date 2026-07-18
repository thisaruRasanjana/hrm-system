from pydantic import BaseModel, EmailStr, field_serializer
from typing import Optional, List, Literal


# ── Dev schemas (RBAC) ────────────────────────────────────────────────────────

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


# ── Auth dashboard schemas (Sanduni) ──────────────────────────────────────────

class UserResponse(BaseModel):
    id: int
    email: str
    username: Optional[str] = None
    is_active: bool
    role: str = "employee"
    role_id: Optional[int] = None
    position: Optional[str] = None
    permissions: List[str] = []
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
    notification_retention_days: Optional[int] = None

    # Fields sourced from Employee model
    designation: Optional[str] = None
    joined_date: Optional[str] = None
    status: Optional[str] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None
    nationality: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_branch: Optional[str] = None
    skills: Optional[str] = None
    qualifications: Optional[str] = None
    designation_history: Optional[List[dict]] = None

    model_config = {"from_attributes": True}

    @field_serializer("profile_image_url")
    def _serialize_profile_image_url(self, value: Optional[str]) -> Optional[str]:
        """Mint a fresh public URL from the stored key on every response.

        Ensures S3 pre-signed URLs (which expire after 1h) are never served
        stale, while leaving local "/uploads/..." paths unchanged.
        """
        from app.core.storage_service import resolve_public_url
        return resolve_public_url(value)


class UserProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    date_of_birth: Optional[str] = None
    emergency_contact_number: Optional[str] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None
    nationality: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_branch: Optional[str] = None
    skills: Optional[str] = None
    qualifications: Optional[str] = None


class UserPasswordUpdate(BaseModel):
    current_password: str
    new_password: str


class UserNotificationUpdate(BaseModel):
    notification_preferences: dict
    # Days to keep notifications before permanent deletion.
    # None = never auto-delete. Restricted to the windows offered in the UI.
    notification_retention_days: Optional[Literal[30, 90, 180, 365]] = None


class LoginRequest(BaseModel):
    """Accepts either email or username in the `email` field, or the dedicated `username` field."""
    email: Optional[str] = None
    username: Optional[str] = None
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
