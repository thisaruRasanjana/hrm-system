from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime


class VacancyCreate(BaseModel):
    title: str
    department: str
    experience_level: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    required_skills: Optional[str] = None
    status: Optional[str] = "Draft"


class VacancyResponse(BaseModel):
    id: int
    title: str
    department: str
    experience_level: Optional[str]
    description: Optional[str]
    requirements: Optional[str]
    required_skills: Optional[str]
    status: str
    created_date: date
    applicants: int

    class Config:
        from_attributes = True

class CandidateResponse(BaseModel):
    id: int
    full_name: str
    phone: Optional[str]
    status: Optional[str]
    ai_score: Optional[float] = None

    class Config:
        from_attributes = True

class UploadSummary(BaseModel):
    successful_uploads: int
    failed_uploads: int
    message: str

class VacancyUpdate(BaseModel):
    description: Optional[str] = None
    requirements: Optional[str] = None
    status: Optional[str] = None


class ApplicationUpdate(BaseModel):
    status: str
    notes: Optional[str] = None

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
    decision: str  # Selected | Rejected | Keep for Future
    notes: Optional[str] = None


class FinalDecisionResponse(BaseModel):
    id: int
    application_id: int
    decision: str
    notes: Optional[str]
    decided_at: datetime

    class Config:
        from_attributes = True