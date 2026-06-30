"""
Recruitment Module — Pydantic Request / Response Schemas

All user-supplied inputs are validated here before they reach the service layer.
Validators raise ValueError with descriptive messages so FastAPI returns a
meaningful 422 response body that the frontend can display directly.
"""

import re
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

# ── Controlled vocabulary sets ─────────────────────────────────────────────────
# Defined as module-level constants so they are easy to find and update without
# touching validator logic.
VALID_EXPERIENCE_LEVELS: frozenset[str] = frozenset({"Intern", "Junior", "Mid", "Senior"})
VALID_VACANCY_STATUSES: frozenset[str] = frozenset({"Draft", "Active", "Closed"})
VALID_DECISIONS: frozenset[str] = frozenset(
    {"Proceed to Next Round", "Job Offered", "Rejected"}
)

# Evaluation scores are on a 1–5 scale; 0 is the DB default before any entry.
SCORE_MIN: int = 0
SCORE_MAX: int = 5

# ── HTML utility ───────────────────────────────────────────────────────────────

_HTML_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(value: str) -> str:
    """
    Strip HTML tags and decode &nbsp; entities to get the plain-text content
    length. Used to enforce a minimum meaningful content requirement on rich-text
    fields where the raw string is HTML but only the visible text counts.
    """
    return _HTML_TAG_RE.sub("", value).replace("&nbsp;", " ").strip()


# ── Vacancy Schemas ────────────────────────────────────────────────────────────

class VacancyCreate(BaseModel):
    """Payload for creating a new vacancy. All text fields are trimmed and validated."""

    title:            str           = Field(..., min_length=3, max_length=100)
    department:       str           = Field(..., min_length=2, max_length=80)
    experience_level: str           = Field(...)
    # description / requirements are rich-text HTML; max_length guards raw HTML size.
    description:      str           = Field(..., max_length=50_000)
    requirements:     str           = Field(..., max_length=50_000)
    status:           Optional[str] = Field("Draft")

    @field_validator("title", "department", mode="before")
    @classmethod
    def strip_whitespace(cls, value: str) -> str:
        """Strip leading/trailing whitespace from all plain-text fields."""
        return value.strip() if isinstance(value, str) else value

    @field_validator("description", "requirements")
    @classmethod
    def validate_rich_text_length(cls, value: str) -> str:
        """
        Ensure rich-text fields contain at least 20 characters of visible content.
        HTML tags alone do not count toward this minimum.
        """
        plain_text = _strip_html(value)
        if len(plain_text) < 20:
            raise ValueError("Must contain at least 20 characters of visible content.")
        return value

    @field_validator("experience_level")
    @classmethod
    def validate_experience_level(cls, value: str) -> str:
        """Reject experience levels not in the controlled vocabulary."""
        if value not in VALID_EXPERIENCE_LEVELS:
            raise ValueError(
                f"Invalid experience level '{value}'. "
                f"Must be one of: {', '.join(sorted(VALID_EXPERIENCE_LEVELS))}."
            )
        return value

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: Optional[str]) -> Optional[str]:
        """Reject statuses not in the controlled vocabulary."""
        if value and value not in VALID_VACANCY_STATUSES:
            raise ValueError(
                f"Invalid status '{value}'. "
                f"Must be one of: {', '.join(sorted(VALID_VACANCY_STATUSES))}."
            )
        return value


class VacancyUpdate(BaseModel):
    """
    Partial update payload for an existing vacancy.
    Only the fields provided will be updated (PATCH semantics).
    """

    description:     Optional[str] = None
    requirements:    Optional[str] = None
    required_skills: Optional[str] = None
    status:          Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: Optional[str]) -> Optional[str]:
        """Same controlled vocabulary as VacancyCreate."""
        if value and value not in VALID_VACANCY_STATUSES:
            raise ValueError(
                f"Invalid status '{value}'. "
                f"Must be one of: {', '.join(sorted(VALID_VACANCY_STATUSES))}."
            )
        return value


class VacancyResponse(BaseModel):
    """Read model for a vacancy — includes the live applicant count."""

    id:               int
    title:            str
    department:       str
    experience_level: Optional[str]
    description:      Optional[str]
    requirements:     Optional[str]
    status:           str
    created_date:     date
    # 'applicants' is a computed field (not a DB column); populated by the service.
    applicants:       int

    model_config = {"from_attributes": True}


class PublicVacancyResponse(BaseModel):
    """
    Safe vacancy view for external candidates — strips internal HR fields
    (status, applicant count) so they are never exposed on the public portal.
    """

    id:               int
    title:            str
    department:       str
    experience_level: Optional[str]
    description:      Optional[str]
    requirements:     Optional[str]
    created_date:     date

    model_config = {"from_attributes": True}


# ── Candidate Schemas ──────────────────────────────────────────────────────────

class CandidateResponse(BaseModel):
    """Read model for a candidate enriched with their application status."""

    id:           int
    full_name:    str
    email:        Optional[str] = None
    phone:        Optional[str] = None
    status:       Optional[str] = None
    active_round: int = 1
    ai_score:     Optional[float] = None
    ai_reasoning: Optional[str] = None

    model_config = {"from_attributes": True}


class CandidateUpdate(BaseModel):
    """
    Payload for HR to manually update a candidate's profile details.
    """

    full_name: Optional[str] = Field(None, max_length=150, description="Full name of the candidate.")
    phone: Optional[str] = Field(None, max_length=50, description="Phone number.")
    email: Optional[EmailStr] = Field(None, description="A valid email address for the candidate.")


# ── Upload Summary Schema ──────────────────────────────────────────────────────

class UploadSummary(BaseModel):
    """Response returned after a bulk CV upload operation."""

    successful_uploads: int
    failed_uploads:     int
    message:            str


# ── Application Schemas ────────────────────────────────────────────────────────

class ApplicationUpdate(BaseModel):
    """Payload for saving call notes on an application."""

    notes: Optional[str] = Field(None, max_length=5_000)


# ── Interview Panel Schemas ────────────────────────────────────────────────────

class InterviewPanelMemberInfo(BaseModel):
    """Lightweight member record returned inside the panel response."""
    user_id:    int
    full_name:  str

    model_config = {"from_attributes": True}


class InterviewPanelCreate(BaseModel):
    """
    Payload for creating or updating an interview panel for a vacancy.

    panel_head_id is required and must belong to a user who has the
    'recruitment:interview_panel' permission (validated server-side).
    member_ids is an ordered list of additional panel member user IDs —
    all must also have the 'recruitment:interview_panel' permission.
    interview_link is an optional Calendly / scheduling URL for the panel.
    """

    panel_head_id:  int             = Field(..., description="User ID of the panel head.")
    interview_link: Optional[str]   = Field(None, max_length=2048)
    member_ids:     list[int]       = Field(default_factory=list)


class InterviewPanelResponse(BaseModel):
    """Read model for an interview panel configuration."""

    id:             int
    vacancy_id:     int
    panel_head_id:  Optional[int]
    panel_head_name: Optional[str]  = None
    interview_link:  Optional[str]
    members:         list[InterviewPanelMemberInfo] = []

    model_config = {"from_attributes": True}


# ── Evaluation Schemas ─────────────────────────────────────────────────────────

class EvaluationCreate(BaseModel):
    """
    Payload submitted by a panel member after an interview.

    All five rating dimensions must be between SCORE_MIN and SCORE_MAX (0–5).
    The overall_score (0–100) is computed server-side; do not send it.
    """

    round_number:     int  = Field(1, ge=1)
    technical_skills: int  = Field(..., ge=SCORE_MIN, le=SCORE_MAX)
    problem_solving:  int  = Field(..., ge=SCORE_MIN, le=SCORE_MAX)
    communication:    int  = Field(..., ge=SCORE_MIN, le=SCORE_MAX)
    cultural_fit:     int  = Field(..., ge=SCORE_MIN, le=SCORE_MAX)
    attitude:         int  = Field(..., ge=SCORE_MIN, le=SCORE_MAX)
    comments:         Optional[str]  = Field(None, max_length=5_000)
    needs_another_round: bool        = False
    evaluator_name:   Optional[str]  = Field(None, max_length=255)
    evaluator_user_id: Optional[int] = None


class EvaluationResponse(BaseModel):
    """Read model for a submitted evaluation scorecard."""

    id:                 int
    application_id:     int
    round_number:       int
    technical_skills:   int
    problem_solving:    int
    communication:      int
    cultural_fit:       int
    attitude:           int
    overall_score:      float
    comments:           Optional[str]
    needs_another_round: bool
    evaluator_name:     Optional[str]
    evaluator_user_id:  Optional[int]
    created_at:         datetime

    model_config = {"from_attributes": True}


# ── Final Decision Schemas ─────────────────────────────────────────────────────

class FinalDecisionCreate(BaseModel):
    """
    Payload for the panel head's conclusive verdict on a candidate.
    decision must be one of the three controlled values in VALID_DECISIONS.
    """

    decision: str           = Field(...)
    notes:    Optional[str] = Field(None, max_length=5_000)

    @field_validator("decision")
    @classmethod
    def validate_decision(cls, value: str) -> str:
        """Reject any decision value not in the controlled vocabulary."""
        if value not in VALID_DECISIONS:
            raise ValueError(
                f"Invalid decision '{value}'. "
                f"Must be one of: {', '.join(sorted(VALID_DECISIONS))}."
            )
        return value


class FinalDecisionResponse(BaseModel):
    """Read model for a recorded final decision."""

    id:             int
    application_id: int
    decision:       str
    notes:          Optional[str]
    decided_at:     datetime

    model_config = {"from_attributes": True}