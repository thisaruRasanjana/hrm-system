from sqlalchemy import Column, Integer, String, DateTime, Numeric, Date, func
from app.database.base import Base


class TimeEntry(Base):
    """
    One row per work session.
    Column names match the ACTUAL PostgreSQL table.
    - status = "active"    while clocked in (end_time is NULL)
    - status = "completed" after clock-out
    """
    __tablename__ = "time_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)       # FK to users.id
    employee_id = Column(String, nullable=True)                 # human-readable EMP-ID

    # Actual column names in DB
    date = Column(Date, nullable=True)                           # date of start_time (PostgreSQL DATE)
    start_time = Column(DateTime, nullable=False)               # clock-in (was clock_in)
    end_time = Column(DateTime, nullable=True)                  # clock-out (was clock_out)
    total_seconds = Column(Integer, nullable=True)              # raw seconds (legacy)

    # New calculated columns
    total_hours = Column(Numeric(8, 4), nullable=True)          # e.g. 8.75
    overtime = Column(Numeric(8, 4), nullable=True)             # hours beyond 8h

    status = Column(String, default="active")                   # "active" | "completed"

    created_at = Column(DateTime, default=func.now())
