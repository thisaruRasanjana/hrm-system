from sqlalchemy import Column, Integer, String, DateTime, Numeric, Date, func
from app.database.base import Base


class TimeEntry(Base):
    """
    One row per calendar day per user — the day-level summary.
    Column names match the ACTUAL PostgreSQL table.
    - status = "active"    while actively working (open check pair)
    - status = "paused"    while paused (no open check pair, but day not ended)
    - status = "completed" after the day is finalized via "End Work"
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
    overtime = Column(Numeric(8, 4), nullable=True)             # hours beyond threshold

    status = Column(String, default="active")                   # "active" | "paused" | "completed"

    # The overtime threshold (hours) that was in effect when this day was finalized.
    # Stored so that historical overtime values are never recomputed.
    applied_threshold = Column(Numeric(5, 2), nullable=True)

    created_at = Column(DateTime, default=func.now())


class TimeCheckPair(Base):
    """
    One row per check-in / check-out segment within a single day.
    A day (TimeEntry) can contain MULTIPLE pairs:
      Start → Pause  = pair #1  (check_in, check_out set)
      Resume → Pause  = pair #2
      Resume → End    = pair #3
    """
    __tablename__ = "time_check_pairs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)             # calendar day
    check_in = Column(DateTime, nullable=False)
    check_out = Column(DateTime, nullable=True)                 # NULL = still working
    seconds = Column(Integer, nullable=True)                    # computed on check-out
    created_at = Column(DateTime, default=func.now())


class OvertimeThresholdHistory(Base):
    """
    Versioned overtime threshold.  Each row records a threshold change
    with an effective_date.  The threshold in effect for any given day
    is the row with the latest effective_date <= that day.
    """
    __tablename__ = "overtime_threshold_history"

    id = Column(Integer, primary_key=True, index=True)
    threshold_hours = Column(Numeric(5, 2), nullable=False)     # e.g. 8.00
    effective_date = Column(Date, nullable=False, index=True)
    created_by_user_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=func.now())
