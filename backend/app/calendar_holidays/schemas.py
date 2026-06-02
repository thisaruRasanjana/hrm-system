from pydantic import BaseModel
from typing import Optional

class HolidayCreate(BaseModel):
    name: str
    date: str
    is_mercantile: bool = True

class HolidayResponse(BaseModel):
    id: int
    name: str
    date: str
    is_mercantile: bool

    class Config:
        from_attributes = True
