from pydantic import BaseModel
from typing import Optional, List
from datetime import date


class VacancyCreate(BaseModel):
    title: str
    department: str
    experience_level: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    status: Optional[str] = "Active"


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