from pydantic import BaseModel
from datetime import datetime

class DesignationBase(BaseModel):
    name: str

class DesignationCreate(DesignationBase):
    pass

class DesignationOut(DesignationBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
