from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import date, datetime
import re

_EXPERIENCE_LEVELS = {"Intern", "Junior", "Mid", "Senior"}
_VACANCY_STATUSES  = {"Draft", "Active", "Closed"}


def _strip_html(value: str) -> str:
    """Strip HTML tags to get plain text content length."""
    return re.sub(r"<[^>]+>", "", value).replace("&nbsp;", " ").strip()


class VacancyCreate(BaseModel):
    title:            str           = Field(..., min_length=3,  max_length=100)
    department:       str           = Field(..., min_length=2,  max_length=80)
    experience_level: str           = Field(...)
    description:      str           = Field(..., max_length=50000)  # HTML — length checked via validator
    requirements:     str           = Field(..., max_length=50000)  # HTML — length checked via validator
    status:           Optional[str] = Field("Draft")

    @field_validator("title", "department", mode="before")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip() if isinstance(v, str) else v

    @field_validator("description", "requirements")
    @classmethod
    def validate_rich_text_length(cls, v: str) -> str:
        plain = _strip_html(v)
        if len(plain) < 20:
            raise ValueError("Must contain at least 20 characters of content.")
        return v

    @field_validator("experience_level")
    @classmethod
    def validate_experience_level(cls, v: str) -> str:
        if v not in _EXPERIENCE_LEVELS:
            raise ValueError(f"Must be one of: {', '.join(sorted(_EXPERIENCE_LEVELS))}")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v and v not in _VACANCY_STATUSES:
            raise ValueError(f"Must be one of: {', '.join(sorted(_VACANCY_STATUSES))}")
        return v


class VacancyResponse(BaseModel):
    id: int
    title: str
    department: str
    experience_level: Optional[str]
    description: Optional[str]
    requirements: Optional[str]
    status: str
    created_date: date
    applicants: int

    class Config:
        from_attributes = True


class PublicVacancyResponse(BaseModel):
    """Safe vacancy view for external candidates — no internal HR fields."""
    id: int
    title: str
    department: str
    experience_level: Optional[str]
    description: Optional[str]
    requirements: Optional[str]
    created_date: date

    class Config:
        from_attributes = True



class CandidateResponse(BaseModel):
    id: int
    full_name: str
    email: Optional[str] = None
    phone: Optional[str]
    status: Optional[str]
    ai_score: Optional[float] = None
    ai_reasoning: Optional[str] = None

    class Config:
        from_attributes = True


class UploadSummary(BaseModel):
    successful_uploads: int
    failed_uploads: int
    message: str


class VacancyUpdate(BaseModel):
    description:      Optional[str] = None
    requirements:     Optional[str] = None
    required_skills:  Optional[str] = None
    status:           Optional[str] = None


class ApplicationUpdate(BaseModel):
    notes: Optional[str] = None


class CandidateUpdate(BaseModel):
    email: str = Field(..., min_length=5, max_length=254)


class InterviewPanelCreate(BaseModel):
    panel_head_id: int | None = None
    panel_member_1_id: int | None = None
    panel_member_2_id: int | None = None
    interview_link: str | None = None


class InterviewPanelResponse(BaseModel):
    id: int
    vacancy_id: int
    panel_head_id: int | None
    panel_member_1_id: int | None
    panel_member_2_id: int | None
    interview_link: str | None

    class Config:
        from_attributes = True


class EvaluationCreate(BaseModel):
    round_number: int = 1          # Explicit round — set by frontend
    technical_skills: int
    problem_solving: int
    communication: int
    cultural_fit: int
    attitude: int
    comments: Optional[str] = None
    needs_another_round: bool = False
    evaluator_name: Optional[str] = None


class EvaluationResponse(BaseModel):
    id: int
    application_id: int
    round_number: int
    technical_skills: int
    problem_solving: int
    communication: int
    cultural_fit: int
    attitude: int
    overall_score: float
    comments: Optional[str]
    needs_another_round: bool
    evaluator_name: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class FinalDecisionCreate(BaseModel):
    # Allowed values: "Proceed to Next Round" | "Job Offered" | "Rejected"
    decision: str
    notes: Optional[str] = None


class FinalDecisionResponse(BaseModel):
    id: int
    application_id: int
    decision: str
    notes: Optional[str]
    decided_at: datetime

    class Config:
        from_attributes = True