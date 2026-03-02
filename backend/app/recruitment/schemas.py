from pydantic import BaseModel
from typing import Optional
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