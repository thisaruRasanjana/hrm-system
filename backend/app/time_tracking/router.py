from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone, timedelta, date as date_type

from app.database.session import get_db
from app.core.deps import get_current_user
from app.auth.models import User
from app.time_tracking.models import TimeEntry
from app.time_tracking.schemas import TimeEntryResponse, ClockStatusResponse, WeeklyStatsResponse

router = APIRouter()

WORK_DAY_HOURS = 8.0   # overtime kicks in beyond 8h/day


# ── Helpers ──────────────────────────────────────────────────────────────────────

def _active_entry(db: Session, user_id: int) -> Optional[TimeEntry]:
    """Returns the open (status='active') session for this user, or None."""
    return (
        db.query(TimeEntry)
        .filter(TimeEntry.user_id == user_id, TimeEntry.status == "active")
        .first()
    )


def _week_bounds(offset: int = 0):
    """Monday 00:00 → Sunday 23:59:59 for the given week offset (0=current)."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    monday = now - timedelta(days=now.weekday()) + timedelta(weeks=offset)
    monday = monday.replace(hour=0, minute=0, second=0, microsecond=0)
    sunday = monday + timedelta(days=6, hours=23, minutes=59, seconds=59)
    return monday, sunday


def _compute_overtime(total_hours: float) -> float:
    return round(max(0.0, total_hours - WORK_DAY_HOURS), 4)


def _to_response(entry: TimeEntry) -> dict:
    """Map DB model → schema dict using actual column names."""
    return {
        "id": entry.id,
        "user_id": entry.user_id,
        "employee_id": entry.employee_id,
        "clock_in":  entry.start_time,       # schema uses clock_in
        "clock_out": entry.end_time,          # schema uses clock_out
        "total_hours": float(entry.total_hours) if entry.total_hours is not None else None,
        "overtime":    float(entry.overtime)    if entry.overtime    is not None else None,
        "status":    entry.status,
        "work_date": entry.date.isoformat() if entry.date else None,
    }


# ── POST /start — Clock In ────────────────────────────────────────────────────────
@router.post("/start", response_model=ClockStatusResponse)
def clock_in(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Start a new work session.
    Returns 400 if user already has an active session (prevents duplicate sessions).
    """
    existing = _active_entry(db, current_user.id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already clocked in. End your current session first."
        )

    now = datetime.utcnow()
    entry = TimeEntry(
        user_id=current_user.id,
        employee_id=current_user.employee_id,
        start_time=now,
        date=now.date(),              # PostgreSQL DATE column
        status="active",
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    return {"active": True, "clock_in": entry.start_time, "entry_id": entry.id}


# ── POST /end — Clock Out ─────────────────────────────────────────────────────────
@router.post("/end", response_model=TimeEntryResponse)
def clock_out(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    End the current work session.
    Calculates total_hours and overtime. Sets status='completed'.
    """
    entry = _active_entry(db, current_user.id)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active session found."
        )

    now = datetime.utcnow()
    diff_seconds = (now - entry.start_time).total_seconds()
    total_hours = round(diff_seconds / 3600, 4)
    overtime = _compute_overtime(total_hours)

    entry.end_time = now
    entry.total_seconds = int(diff_seconds)
    entry.total_hours = total_hours
    entry.overtime = overtime
    entry.status = "completed"
    db.commit()
    db.refresh(entry)

    return _to_response(entry)


# ── GET /current — Active session (source of truth for timer) ─────────────────────
@router.get("/current", response_model=ClockStatusResponse)
def get_current_session(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the active session's clock_in timestamp.
    Frontend always calls this on mount — NEVER use localStorage as source of truth.
    Timer elapsed = now - clock_in (JavaScript does the math).
    """
    entry = _active_entry(db, current_user.id)
    if entry:
        return {"active": True, "clock_in": entry.start_time, "entry_id": entry.id}
    return {"active": False}


# ── GET /history — All entries (filterable by week) ───────────────────────────────
@router.get("/history", response_model=List[TimeEntryResponse])
def get_history(
    week: int = 0,    # 0=current week, -1=last week
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns all entries for the logged-in user, ordered newest first.
    Multi-user safe: only returns this user's data.
    """
    monday, sunday = _week_bounds(week)
    entries = (
        db.query(TimeEntry)
        .filter(
            TimeEntry.user_id == current_user.id,
            TimeEntry.start_time >= monday,
            TimeEntry.start_time <= sunday,
        )
        .order_by(TimeEntry.start_time.desc())
        .all()
    )
    return [_to_response(e) for e in entries]


# ── GET /weekly-stats — Summary for the stats cards ──────────────────────────────
@router.get("/weekly-stats", response_model=WeeklyStatsResponse)
def get_weekly_stats(
    week: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Aggregated weekly stats: total_hours, regular_hours, overtime_hours, avg_clock_in.
    Only counts completed entries.
    """
    monday, sunday = _week_bounds(week)
    all_entries = (
        db.query(TimeEntry)
        .filter(
            TimeEntry.user_id == current_user.id,
            TimeEntry.start_time >= monday,
            TimeEntry.start_time <= sunday,
        )
        .order_by(TimeEntry.start_time.desc())
        .all()
    )

    completed = [e for e in all_entries if e.status == "completed" and e.total_hours is not None]

    total = round(sum(float(e.total_hours) for e in completed), 2)
    ot_sum = round(sum(float(e.overtime or 0) for e in completed), 2)
    regular = round(max(0.0, total - ot_sum), 2)

    # Average clock-in time (HH:MM)
    avg_clock_in = None
    if completed:
        avg_mins = sum(e.start_time.hour * 60 + e.start_time.minute for e in completed) // len(completed)
        avg_clock_in = f"{avg_mins // 60:02d}:{avg_mins % 60:02d} AM" if avg_mins < 720 else f"{(avg_mins-720)//60 + 12:02d}:{avg_mins%60:02d} PM"

    return {
        "week_start": monday.strftime("%Y-%m-%d"),
        "week_end":   sunday.strftime("%Y-%m-%d"),
        "total_hours":    total,
        "regular_hours":  regular,
        "overtime_hours": ot_sum,
        "avg_clock_in":   avg_clock_in,
        "entries":        [_to_response(e) for e in all_entries],
    }


# ── Backward-compat aliases ───────────────────────────────────────────────────────

@router.get("/status", response_model=ClockStatusResponse)
def status_compat(db=Depends(get_db), current_user=Depends(get_current_user)):
    return get_current_session(db, current_user)

@router.post("/clock-in", response_model=ClockStatusResponse)
def clock_in_compat(db=Depends(get_db), current_user=Depends(get_current_user)):
    return clock_in(db, current_user)

@router.post("/clock-out", response_model=TimeEntryResponse)
def clock_out_compat(db=Depends(get_db), current_user=Depends(get_current_user)):
    return clock_out(db, current_user)

@router.get("/entries", response_model=List[TimeEntryResponse])
def entries_compat(db=Depends(get_db), current_user=Depends(get_current_user)):
    return get_history(0, db, current_user)
