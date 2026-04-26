"""
Employee Module — Pydantic Schemas

Input validation and response shapes for employee endpoints.
"""

from datetime import date
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator


# ── Request Schemas ────────────────────────────────────────────────────────────

class EmployeeCreate(BaseModel):
    """Payload for creating a new employee. All text is trimmed before validation."""

    first_name:      str            = Field(..., min_length=1, max_length=100)
    last_name:       str            = Field(..., min_length=1, max_length=100)
    email:           Optional[EmailStr] = None
    employee_number: Optional[str]  = Field(None, max_length=20)
    department:      Optional[str]  = Field(None, max_length=100)
    job_title:       Optional[str]  = Field(None, max_length=150)
    gender:          Optional[str]  = Field(None, max_length=1)
    date_joined:     Optional[date] = None

    @field_validator("first_name", "last_name", mode="before")
    @classmethod
    def strip_name(cls, value: str) -> str:
        """Remove accidental leading/trailing whitespace from names."""
        return value.strip() if isinstance(value, str) else value

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, value: Optional[str]) -> Optional[str]:
        """Gender must be a single-character code: M, F, or O (Other)."""
        if value is not None and value.upper() not in {"M", "F", "O"}:
            raise ValueError("gender must be 'M', 'F', or 'O'.")
        return value.upper() if value else value


class EmployeeUpdate(BaseModel):
    """Partial update — only provided fields are changed (PATCH semantics)."""

    first_name:  Optional[str]      = Field(None, min_length=1, max_length=100)
    last_name:   Optional[str]      = Field(None, min_length=1, max_length=100)
    email:       Optional[EmailStr] = None
    department:  Optional[str]      = Field(None, max_length=100)
    job_title:   Optional[str]      = Field(None, max_length=150)
    gender:      Optional[str]      = Field(None, max_length=1)
    date_joined: Optional[date]     = None
    is_active:   Optional[int]      = None


# ── Response Schemas ───────────────────────────────────────────────────────────

class EmployeeResponse(BaseModel):
    """Full read model for an employee record."""

    id:              int
    first_name:      str
    last_name:       str
    email:           Optional[str]
    employee_number: Optional[str]
    department:      Optional[str]
    job_title:       Optional[str]
    gender:          Optional[str]
    date_joined:     Optional[date]
    is_active:       int

    model_config = {"from_attributes": True}


class EmployeePanelOption(BaseModel):
    """
    Minimal employee view used to populate interview panel dropdowns.
    Only exposes the fields needed for selection — never returns sensitive data.
    """

    id:         int
    first_name: str
    last_name:  str
    job_title:  Optional[str]

    model_config = {"from_attributes": True}
