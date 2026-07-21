from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from typing import List, Optional
from datetime import datetime, timezone, timedelta, date as date_type
from decimal import Decimal

from app.database.database import get_db
from app.core.deps import get_current_user, require_permission
from app.auth.models import User
from app.time_tracking.models import TimeEntry, TimeCheckPair, OvertimeThresholdHistory
from app.time_tracking.schemas import (
    TimeEntryResponse,
    ClockStatusResponse,
    WeeklyStatsResponse,
    DayEntryResponse,
    CheckPairResponse,
    OvertimeThresholdResponse,
    AllAttendanceResponse,
)

router = APIRouter()

DEFAULT_THRESHOLD = 8.0  # fallback if no threshold row exists


# ── Helpers ──────────────────────────────────────────────────────────────────────

def _get_threshold_for_date(db: Session, target_date: date_type) -> float:
    """Returns the overtime threshold (hours) effective on the given date."""
    row = (
        db.query(OvertimeThresholdHistory)
        .filter(OvertimeThresholdHistory.effective_date <= target_date)
        .order_by(OvertimeThresholdHistory.effective_date.desc())
        .first()
    )
    return float(row.threshold_hours) if row else DEFAULT_THRESHOLD


def _get_current_threshold(db: Session) -> float:
    """Returns the most recently set threshold (for display / future use)."""
    row = (
        db.query(OvertimeThresholdHistory)
        .order_by(OvertimeThresholdHistory.effective_date.desc())
        .first()
    )
    return float(row.threshold_hours) if row else DEFAULT_THRESHOLD


def _today_entry(db: Session, user_id: int) -> Optional[TimeEntry]:
    """Returns today's TimeEntry for this user (if any)."""
    today = datetime.utcnow().date()
    return (
        db.query(TimeEntry)
        .filter(
            TimeEntry.user_id == user_id,
            TimeEntry.date == today,
            TimeEntry.status.in_(["active", "paused"]),
        )
        .first()
    )


def _open_pair(db: Session, user_id: int) -> Optional[TimeCheckPair]:
    """Returns the currently open (no check_out) pair for this user."""
    return (
        db.query(TimeCheckPair)
        .filter(
            TimeCheckPair.user_id == user_id,
            TimeCheckPair.check_out.is_(None),
        )
        .first()
    )


def _accumulated_seconds(db: Session, user_id: int, target_date: date_type) -> int:
    """Sum of seconds from all COMPLETED pairs for the given day."""
    pairs = (
        db.query(TimeCheckPair)
        .filter(
            TimeCheckPair.user_id == user_id,
            TimeCheckPair.date == target_date,
            TimeCheckPair.check_out.isnot(None),
        )
        .all()
    )
    return sum(p.seconds or 0 for p in pairs)


def _close_pair(pair: TimeCheckPair, now: datetime) -> None:
    """Close an open pair by setting check_out and computing seconds."""
    pair.check_out = now
    pair.seconds = int((now - pair.check_in).total_seconds())


def _finalize_day(db: Session, entry: TimeEntry, now: datetime) -> None:
    """Finalize a day: compute total_hours, overtime, set status=completed."""
    today = entry.date or now.date()

    # Close any still-open pair
    open_pair = _open_pair(db, entry.user_id)
    if open_pair and open_pair.date == today:
        _close_pair(open_pair, now)
        db.flush()

    total_secs = _accumulated_seconds(db, entry.user_id, today)
    total_hours = round(total_secs / 3600, 4)

    threshold = _get_threshold_for_date(db, today)
    overtime = round(max(0.0, total_hours - threshold), 4)

    entry.end_time = now
    entry.total_seconds = total_secs
    entry.total_hours = total_hours
    entry.overtime = overtime
    entry.applied_threshold = Decimal(str(threshold))
    entry.status = "completed"


def _week_bounds(offset: int = 0):
    """Monday 00:00 → Sunday 23:59:59 for the given week offset (0=current)."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    monday = now - timedelta(days=now.weekday()) + timedelta(weeks=offset)
    monday = monday.replace(hour=0, minute=0, second=0, microsecond=0)
    sunday = monday + timedelta(days=6, hours=23, minutes=59, seconds=59)
    return monday, sunday


def _pairs_for_date(db: Session, user_id: int, target_date: date_type) -> List[dict]:
    """Returns serialized check pairs for a given date."""
    pairs = (
        db.query(TimeCheckPair)
        .filter(
            TimeCheckPair.user_id == user_id,
            TimeCheckPair.date == target_date,
        )
        .order_by(TimeCheckPair.check_in.asc())
        .all()
    )
    return [
        {
            "id": p.id,
            "check_in": p.check_in,
            "check_out": p.check_out,
            "seconds": p.seconds,
        }
        for p in pairs
    ]


def _day_entry_response(db: Session, entry: TimeEntry) -> dict:
    """Build a DayEntryResponse dict from a TimeEntry."""
    entry_date = entry.date or (entry.start_time.date() if entry.start_time else None)
    date_str = entry_date.isoformat() if entry_date else None

    # For active/paused entries, compute live total from completed pairs
    if entry.status in ("active", "paused") and entry_date:
        completed_secs = _accumulated_seconds(db, entry.user_id, entry_date)
        total_hours = round(completed_secs / 3600, 4) if completed_secs else 0.0
        # For active (currently ticking), the frontend will add the live delta
    else:
        total_hours = float(entry.total_hours) if entry.total_hours is not None else None

    overtime_val = float(entry.overtime) if entry.overtime is not None else None

    pairs = _pairs_for_date(db, entry.user_id, entry_date) if entry_date else []

    return {
        "date": date_str,
        "total_hours": total_hours,
        "overtime": overtime_val,
        "status": entry.status,
        "pairs": pairs,
    }


def _to_legacy_response(entry: TimeEntry) -> dict:
    """Map DB model → legacy TimeEntryResponse dict (backward compat)."""
    return {
        "id": entry.id,
        "user_id": entry.user_id,
        "employee_id": entry.employee_id,
        "clock_in": entry.start_time,
        "clock_out": entry.end_time,
        "total_hours": float(entry.total_hours) if entry.total_hours is not None else None,
        "overtime": float(entry.overtime) if entry.overtime is not None else None,
        "status": entry.status,
        "work_date": entry.date.isoformat() if entry.date else None,
    }


# ── POST /start — Start Work ─────────────────────────────────────────────────────
@router.post("/start", response_model=ClockStatusResponse)
def clock_in(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Start a new work session.
    Creates or reuses today's TimeEntry and opens a new check pair.
    Returns 400 if user already has an active/paused session today.
    """
    existing = _today_entry(db, current_user.id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already clocked in today. Use pause/resume or end your current session first."
        )

    # One clock-in cycle per day: once the day has been ended (status
    # 'completed'), Start must be refused rather than opening a second day-entry.
    # Pause/resume is the way to take breaks within the single start…end cycle.
    completed_today = (
        db.query(TimeEntry)
        .filter(
            TimeEntry.user_id == current_user.id,
            TimeEntry.date == datetime.utcnow().date(),
            TimeEntry.status == "completed",
        )
        .first()
    )
    if completed_today:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already clocked in today. Your work day has already ended."
        )

    # Also check for any open pair from a previous day (safety guard)
    stale_pair = _open_pair(db, current_user.id)
    if stale_pair:
        # Auto-close the stale pair
        _close_pair(stale_pair, stale_pair.check_in + timedelta(seconds=1))
        db.flush()

    now = datetime.utcnow()
    today = now.date()

    # Create day-level entry
    entry = TimeEntry(
        user_id=current_user.id,
        employee_id=current_user.employee_id,
        start_time=now,
        date=today,
        status="active",
    )
    db.add(entry)
    db.flush()

    # Create first check pair
    pair = TimeCheckPair(
        user_id=current_user.id,
        date=today,
        check_in=now,
    )
    db.add(pair)
    db.commit()
    db.refresh(entry)

    return {
        "active": True,
        "paused": False,
        "clock_in": now,
        "elapsed_seconds": 0,
        "entry_id": entry.id,
    }


# ── POST /pause — Pause Work ─────────────────────────────────────────────────────
@router.post("/pause", response_model=ClockStatusResponse)
def pause_work(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Pause the current work session.
    Closes the open check pair and sets day status to 'paused'.
    Timer should freeze on the frontend.
    """
    entry = _today_entry(db, current_user.id)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active session found. Start work first."
        )

    if entry.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session is not currently active (already paused or completed)."
        )

    pair = _open_pair(db, current_user.id)
    if not pair:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No open check pair found to pause."
        )

    now = datetime.utcnow()
    _close_pair(pair, now)
    entry.status = "paused"
    db.commit()

    accumulated = _accumulated_seconds(db, current_user.id, entry.date or now.date())
    return {
        "active": True,
        "paused": True,
        "clock_in": None,
        "elapsed_seconds": accumulated,
        "entry_id": entry.id,
    }


# ── POST /resume — Resume Work ───────────────────────────────────────────────────
@router.post("/resume", response_model=ClockStatusResponse)
def resume_work(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Resume work after a pause.
    Opens a new check pair and sets day status back to 'active'.
    """
    entry = _today_entry(db, current_user.id)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active session found. Start work first."
        )

    if entry.status != "paused":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session is not paused. Cannot resume."
        )

    now = datetime.utcnow()
    today = now.date()

    pair = TimeCheckPair(
        user_id=current_user.id,
        date=today,
        check_in=now,
    )
    db.add(pair)

    entry.status = "active"
    db.commit()

    accumulated = _accumulated_seconds(db, current_user.id, today)
    return {
        "active": True,
        "paused": False,
        "clock_in": now,
        "elapsed_seconds": accumulated,
        "entry_id": entry.id,
    }


# ── POST /end — End Work ─────────────────────────────────────────────────────────
@router.post("/end", response_model=DayEntryResponse)
def clock_out(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    End the current work session.
    Closes any open pair, finalizes the day (computes total + overtime),
    and sets status='completed'.
    """
    entry = _today_entry(db, current_user.id)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active session found."
        )

    now = datetime.utcnow()
    _finalize_day(db, entry, now)
    db.commit()
    db.refresh(entry)

    return _day_entry_response(db, entry)


# ── GET /current — Active session (source of truth for timer) ─────────────────────
@router.get("/current", response_model=ClockStatusResponse)
def get_current_session(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the current session state:
    - active=False → not clocked in
    - active=True, paused=False → working (clock_in = open pair's check-in)
    - active=True, paused=True → paused (clock_in = None, elapsed_seconds = accumulated)
    Frontend always calls this on mount — NEVER use localStorage as source of truth.
    """
    entry = _today_entry(db, current_user.id)
    if not entry:
        completed_today = (
            db.query(TimeEntry)
            .filter(
                TimeEntry.user_id == current_user.id,
                TimeEntry.date == datetime.utcnow().date(),
                TimeEntry.status == "completed",
            )
            .first()
        )
        return {"active": False, "paused": False, "completed": bool(completed_today), "elapsed_seconds": 0}

    today = entry.date or datetime.utcnow().date()
    accumulated = _accumulated_seconds(db, current_user.id, today)

    if entry.status == "paused":
        return {
            "active": True,
            "paused": True,
            "clock_in": None,
            "elapsed_seconds": accumulated,
            "entry_id": entry.id,
        }

    # status == "active" → there should be an open pair
    pair = _open_pair(db, current_user.id)
    return {
        "active": True,
        "paused": False,
        "clock_in": pair.check_in if pair else entry.start_time,
        "elapsed_seconds": accumulated,
        "entry_id": entry.id,
    }


# ── GET /history — Day-grouped entries (filterable by week) ───────────────────────
@router.get("/history", response_model=List[DayEntryResponse])
def get_history(
    week: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns day-grouped entries for the logged-in user, ordered newest first.
    Each day is a single row with nested check-in/check-out pairs.
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

    # Group by date — there should already be one entry per day,
    # but handle legacy duplicates by merging
    day_map: dict = {}
    for e in entries:
        d = (e.date or e.start_time.date()).isoformat()
        if d not in day_map:
            day_map[d] = e
        # If duplicate date entries exist (legacy), keep the one with higher total
        # This shouldn't happen going forward

    return [_day_entry_response(db, entry) for entry in day_map.values()]


# ── GET /weekly-stats — Summary for the stats cards ──────────────────────────────
@router.get("/weekly-stats", response_model=WeeklyStatsResponse)
def get_weekly_stats(
    week: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Aggregated weekly stats: total_hours, regular_hours, overtime_hours.
    Now uses per-day totals and the configurable overtime threshold.
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

    # Group by date
    day_map: dict = {}
    for e in all_entries:
        d = (e.date or e.start_time.date()).isoformat()
        if d not in day_map:
            day_map[d] = e

    day_entries = list(day_map.values())
    completed = [e for e in day_entries if e.status == "completed" and e.total_hours is not None]

    total = round(sum(float(e.total_hours) for e in completed), 2)
    ot_sum = round(sum(float(e.overtime or 0) for e in completed), 2)
    regular = round(max(0.0, total - ot_sum), 2)

    # Include in-progress entries in total for display
    for e in day_entries:
        if e.status in ("active", "paused") and e.date:
            live_secs = _accumulated_seconds(db, current_user.id, e.date)
            if e.status == "active":
                pair = _open_pair(db, current_user.id)
                if pair:
                    live_secs += int((datetime.utcnow() - pair.check_in).total_seconds())
            live_hours = round(live_secs / 3600, 2)
            total = round(total + live_hours, 2)
            threshold = _get_threshold_for_date(db, e.date)
            live_ot = round(max(0.0, live_hours - threshold), 2)
            ot_sum = round(ot_sum + live_ot, 2)
            regular = round(max(0.0, total - ot_sum), 2)

    current_threshold = _get_current_threshold(db)

    # Build day-grouped response
    day_responses = [_day_entry_response(db, entry) for entry in day_entries]

    return {
        "week_start": monday.strftime("%Y-%m-%d"),
        "week_end": sunday.strftime("%Y-%m-%d"),
        "total_hours": total,
        "regular_hours": regular,
        "overtime_hours": ot_sum,
        "overtime_threshold": current_threshold,
        "entries": day_responses,
    }


# ── GET /overtime-threshold — Current effective threshold ─────────────────────────
@router.get("/overtime-threshold", response_model=OvertimeThresholdResponse)
def get_overtime_threshold(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns the currently effective overtime threshold."""
    row = (
        db.query(OvertimeThresholdHistory)
        .order_by(OvertimeThresholdHistory.effective_date.desc())
        .first()
    )
    if row:
        return {
            "threshold_hours": float(row.threshold_hours),
            "effective_date": row.effective_date.isoformat(),
        }
    return {
        "threshold_hours": DEFAULT_THRESHOLD,
        "effective_date": "2000-01-01",
    }


# ── PUT /overtime-threshold — Update threshold (permission-gated) ─────────────────
@router.put(
    "/overtime-threshold",
    response_model=OvertimeThresholdResponse,
    dependencies=[Depends(require_permission("time_tracking:edit_overtime_threshold"))],
)
def update_overtime_threshold(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update the overtime threshold. Creates a new history row with
    effective_date = today. Only affects future/today's overtime calculations.
    Past finalized days remain unchanged.
    """
    new_threshold = payload.get("threshold_hours")
    if new_threshold is None or not isinstance(new_threshold, (int, float)):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="threshold_hours is required and must be a number."
        )
    if new_threshold <= 0 or new_threshold > 24:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="threshold_hours must be between 0 and 24."
        )

    today = datetime.utcnow().date()
    row = OvertimeThresholdHistory(
        threshold_hours=Decimal(str(round(new_threshold, 2))),
        effective_date=today,
        created_by_user_id=current_user.id,
    )
    db.add(row)
    db.commit()

    return {
        "threshold_hours": float(row.threshold_hours),
        "effective_date": row.effective_date.isoformat(),
    }


# ── Backward-compat aliases ───────────────────────────────────────────────────────

@router.get("/status", response_model=ClockStatusResponse)
def status_compat(db=Depends(get_db), current_user=Depends(get_current_user)):
    return get_current_session(db, current_user)

@router.post("/clock-in", response_model=ClockStatusResponse)
def clock_in_compat(db=Depends(get_db), current_user=Depends(get_current_user)):
    return clock_in(db, current_user)

@router.post("/clock-out", response_model=DayEntryResponse)
def clock_out_compat(db=Depends(get_db), current_user=Depends(get_current_user)):
    return clock_out(db, current_user)

@router.get("/all-attendance", response_model=AllAttendanceResponse, dependencies=[Depends(require_permission("attendance:view_others"))])
def get_all_attendance(
    period: str = "week",
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """
    Returns attendance records for all active users based on the specified period (day/week/month)
    and offset (0 = current, -1 = previous, etc.).
    Requires 'attendance:view_others' permission.
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    
    if period == "day":
        target_date = (now + timedelta(days=offset)).date()
        start_date = datetime(target_date.year, target_date.month, target_date.day)
        end_date = start_date + timedelta(days=1, microseconds=-1)
    elif period == "month":
        # Simplified month arithmetic (good enough for typical offsets)
        target_month = now.month + offset
        target_year = now.year
        while target_month <= 0:
            target_month += 12
            target_year -= 1
        while target_month > 12:
            target_month -= 12
            target_year += 1
        start_date = datetime(target_year, target_month, 1)
        # Next month start minus 1 microsecond
        next_month = target_month + 1 if target_month < 12 else 1
        next_year = target_year if target_month < 12 else target_year + 1
        end_date = datetime(next_year, next_month, 1) - timedelta(microseconds=1)
    else:  # default to week
        monday, sunday = _week_bounds(offset)
        start_date = monday
        end_date = sunday
        
    start_date_only = start_date.date()
    end_date_only = end_date.date()

    # Source the roster from real EMPLOYEE records (not raw users). This excludes
    # non-employee accounts such as super admins, and lets us read the AUTHORITATIVE
    # department (employees.department_id → departments.name) and role
    # (users.roles → role_name) instead of the stale/backward-compat
    # users.department and users.role scalar columns.
    from app.employees.models import Employee
    employees = (
        db.query(Employee)
        .options(
            joinedload(Employee.department_rel),
            joinedload(Employee.user).joinedload(User.roles),
        )
        .filter(Employee.is_deleted == False)
        .all()
    )

    # Query time entries in the range, grouped by the owning user
    entries = db.query(TimeEntry).filter(
        TimeEntry.date >= start_date_only,
        TimeEntry.date <= end_date_only,
    ).all()
    entries_by_user: dict = {}
    for e in entries:
        entries_by_user.setdefault(e.user_id, []).append(e)

    items = []
    for emp in employees:
        user = emp.user
        # Skip employees with no linked login, or whose account is inactive/deleted
        if not user or not user.is_active or user.is_deleted:
            continue

        user_entries = entries_by_user.get(user.id, [])
        total_hours = 0.0
        overtime = 0.0
        for e in user_entries:
            # Live total for in-progress days (mirrors _day_entry_response)
            if e.status in ("active", "paused") and e.date:
                completed_secs = _accumulated_seconds(db, e.user_id, e.date)
                e_hours = round(completed_secs / 3600, 4) if completed_secs else 0.0
            else:
                e_hours = float(e.total_hours) if e.total_hours is not None else 0.0

            total_hours += e_hours
            overtime += float(e.overtime) if e.overtime is not None else 0.0

        # Authoritative role: first role assigned via the RBAC join table; only
        # fall back to the legacy scalar when no role is linked.
        role_name = user.roles[0].role_name if user.roles else (user.role or None)
        # Authoritative department: from the employee's department FK.
        dept_name = emp.department_rel.name if emp.department_rel else None

        items.append({
            "user_id": user.id,
            "first_name": emp.first_name,
            "last_name": emp.last_name,
            "employee_id": emp.employee_id,
            "department": dept_name,
            "role": role_name,
            "total_hours": round(total_hours, 4),
            "overtime": round(overtime, 4),
        })

    return {
        "period": period,
        "start_date": start_date_only.isoformat(),
        "end_date": end_date_only.isoformat(),
        "items": items,
    }


@router.get("/entries", response_model=List[DayEntryResponse])
def entries_compat(db=Depends(get_db), current_user=Depends(get_current_user)):
    return get_history(0, db, current_user)
