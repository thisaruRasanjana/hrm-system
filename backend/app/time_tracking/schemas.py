from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class TimeEntryResponse(BaseModel):
    id: int
    user_id: int
    employee_id: Optional[str] = None
    clock_in: datetime                         # mapped from start_time
    clock_out: Optional[datetime] = None       # mapped from end_time
    total_hours: Optional[float] = None        # decimal hours e.g. 8.75
    overtime: Optional[float] = None           # hours beyond 8h, 0 if under
    status: str = "active"                     # "active" | "completed"
    work_date: Optional[str] = None            # mapped from date (YYYY-MM-DD)

    class Config:
        from_attributes = True


class ClockStatusResponse(BaseModel):
    active: bool
    clock_in: Optional[datetime] = None        # UTC timestamp from DB start_time
    entry_id: Optional[int] = None


class WeeklyStatsResponse(BaseModel):
    week_start: str                            # YYYY-MM-DD
    week_end: str
    total_hours: float
    regular_hours: float                       # total - overtime
    overtime_hours: float
    avg_clock_in: Optional[str] = None        # e.g. "08:54 AM"
    entries: List[TimeEntryResponse]
