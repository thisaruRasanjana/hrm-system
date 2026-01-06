from pydantic import BaseModel
from typing import Optional

class VacancyCreate(BaseModel):
    title: str
    department: str
    experience_level: Optional[str] = None
    description: Optional[str] = None

class VacancyOut(VacancyCreate):
    id: int

    class Config:
        from_attributes = True