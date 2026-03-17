from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class CreateRequest(BaseModel):
    employee_id: UUID
    document_type: str
    purpose: str


class RequestResponse(BaseModel):
    id: UUID
    document_type: str
    purpose: str
    status: str
    created_at: datetime

    class Config:
        orm_mode = True