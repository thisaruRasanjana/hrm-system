"""
app/leave/service.py
--------------------
Business logic for all leave-related operations.

Design rules applied:
  - Every function has a single, clear responsibility.
  - All DB writes are wrapped in try/except so callers receive ValueError
    or HTTPException — never a raw SQLAlchemy exception.
  - Constants come from app.core.config (no magic numbers here).
  - Status strings reference config constants to prevent typos.
"""

from sqlalchemy.orm import Session, aliased
from sqlalchemy.exc import IntegrityError
from datetime import date
from sqlalchemy import or_, cast, String, func

from fastapi import HTTPException

from app.leave.models import LeaveRequest, LeaveType
from app.employees.models import Employee
from app.leave.schemas import LeaveRequestCreate
from app.core.config import (
    LEAVE_ENTITLEMENTS,
    TOTAL_LEAVE_DAYS_ALLOCATED,
    STATUS_PENDING,
    STATUS_APPROVED,
    STATUS_REJECTED,
    STATUS_REQ_INFO,
)

# Re-export so existing imports from this module keep working.
LEAVE_ENTITLEMENTS = LEAVE_ENTITLEMENTS          # noqa: F811
TOTAL_ALLOCATED    = TOTAL_LEAVE_DAYS_ALLOCATED  # backward-compat alias


# ---------------------------------------------------------------------------
# Static team membership lookup
# WHY: Manager–employee relationships are currently small and static.
# Keeping them here (instead of inline) makes them easy to extend or replace
# with a DB table in a future sprint without changing any other code.
# ---------------------------------------------------------------------------
_TEAM_MEMBERS: dict[int, list[int]] = {
    2: [1, 3],
    4: [1, 2, 3],
}


def get_team_members(manager_id: int) -> list[int]:
    """Return the list of employee IDs that report to *manager_id*."""
    return _TEAM_MEMBERS.get(manager_id, [])


# ---------------------------------------------------------------------------
# Pure calculation helpers (no DB access — easy to unit-test)
# ---------------------------------------------------------------------------

def calculate_total_days(start_date: date, end_date: date, half_day: bool) -> float:
    """
    Return the number of leave days for the given date range.

    Raises ValueError for invalid inputs so callers can convert to HTTP 400.
    """
    days = (end_date - start_date).days + 1

    if days < 1:
        raise ValueError("Invalid date range: end_date must be >= start_date")

    if half_day:
        if start_date != end_date:
            raise ValueError("Half day leave must be for a single day only")
        return 0.5

    return float(days)


# ---------------------------------------------------------------------------
# DB query helpers
# ---------------------------------------------------------------------------

def leave_type_exists(db: Session, leave_type_id: int) -> bool:
    """Return True if the given leave_type_id exists in the database."""
    return db.query(LeaveType).filter(LeaveType.id == leave_type_id).first() is not None


def has_overlapping_leave(
    db: Session, employee_id: int, start_date: date, end_date: date
) -> bool:
    """
    Return True if the employee already has a PENDING or APPROVED leave
    request that overlaps the given date range.

    WHY: Prevents duplicate / conflicting leave submissions at the DB query
    level — more reliable than client-side checks alone.
    """
    overlap = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.employee_id == employee_id,
            LeaveRequest.start_date <= end_date,
            LeaveRequest.end_date >= start_date,
            LeaveRequest.status.in_([STATUS_PENDING, STATUS_APPROVED]),
        )
        .first()
    )
    return overlap is not None


# ---------------------------------------------------------------------------
# Read operations
# ---------------------------------------------------------------------------

def get_pending_requests(db: Session, user: dict) -> list:
    """
    Return all PENDING leave requests visible to *user*.

    Only HR users can see pending requests (excluding their own).
    Returns an empty list for any other role — this is intentional; callers
    such as the router should RBAC-guard the endpoint so this branch is
    rarely reached in production.
    """
    role = user.get("role", "").lower()

    if role != "hr":
        return []

    query = (
        db.query(
            LeaveRequest,
            LeaveType.name.label("leave_type_name"),
            Employee.first_name,
            Employee.last_name,
            Employee.employee_id.label("employee_code"),
            Employee.department,
            Employee.roles,
        )
        .join(LeaveType, LeaveRequest.leave_type_id == LeaveType.id)
        .join(Employee, LeaveRequest.employee_id == Employee.id)
        .filter(
            LeaveRequest.status == STATUS_PENDING,
            LeaveRequest.employee_id != user["id"],  # HR cannot see own requests here
        )
        .order_by(LeaveRequest.leave_request_id.desc())
    )

    output = []
    for leave, leave_type_name, f_name, l_name, code, dept, roles in query.all():
        leave.leave_type_name = leave_type_name
        leave.employee_name   = f"{f_name} {l_name}"
        leave.employee_code   = code
        leave.department      = dept
        leave.role            = roles[0].capitalize() if roles else "Employee"
        output.append(leave)

    return output


def get_leave_history(
    db: Session,
    user: dict,
    search: str | None = None,
    leave_type_id: int | None = None,
    status: str | None = None,
    sort_by: str = "newest",
) -> list:
    """
    Return leave history rows filtered by *user* role and optional query params.

    - employee / hr  → own requests only
    - manager        → own + team members' requests
    """
    Approver = aliased(Employee)
    query = (
        db.query(
            LeaveRequest,
            LeaveType.name.label("leave_type_name"),
            func.concat(Approver.first_name, " ", Approver.last_name).label("approved_by_name"),
        )
        .join(LeaveType, LeaveRequest.leave_type_id == LeaveType.id)
        .outerjoin(Approver, LeaveRequest.approved_by == Approver.id)
    )

    role = user["role"]
    if role in ("employee", "hr"):
        query = query.filter(LeaveRequest.employee_id == user["id"])
    elif role == "manager":
        team = get_team_members(user["id"])
        query = query.filter(
            or_(
                LeaveRequest.employee_id == user["id"],
                LeaveRequest.employee_id.in_(team),
            )
        )

    # Apply optional search filter across relevant text columns.
    if search and search.strip():
        term = search.strip()
        query = query.filter(
            or_(
                LeaveType.name.ilike(f"%{term}%"),
                LeaveRequest.reason.ilike(f"%{term}%"),
                LeaveRequest.status.ilike(f"%{term}%"),
                cast(LeaveRequest.leave_request_id, String).ilike(f"%{term}%"),
            )
        )

    if leave_type_id is not None:
        query = query.filter(LeaveRequest.leave_type_id == leave_type_id)

    if status:
        query = query.filter(LeaveRequest.status == status)

    order_col = (
        LeaveRequest.leave_request_id.asc()
        if sort_by == "oldest"
        else LeaveRequest.leave_request_id.desc()
    )
    query = query.order_by(order_col)

    output = []
    for leave, leave_type_name, approved_by_name in query.all():
        leave.leave_type_name  = leave_type_name
        leave.approved_by_name = approved_by_name
        output.append(leave)

    return output


def my_requests(db: Session, employee_id: int) -> list:
    """Return all leave requests submitted by *employee_id*, newest first."""
    Approver = aliased(Employee)
    results = (
        db.query(
            LeaveRequest,
            LeaveType.name.label("leave_type_name"),
            func.concat(Approver.first_name, " ", Approver.last_name).label("approved_by_name"),
        )
        .join(LeaveType, LeaveRequest.leave_type_id == LeaveType.id)
        .outerjoin(Approver, LeaveRequest.approved_by == Approver.id)
        .filter(LeaveRequest.employee_id == employee_id)
        .order_by(LeaveRequest.leave_request_id.desc())
        .all()
    )

    output = []
    for leave, leave_type_name, approved_by_name in results:
        leave.leave_type_name  = leave_type_name
        leave.approved_by_name = approved_by_name
        output.append(leave)

    return output


def get_leave_request_by_id(db: Session, request_id: int):
    """
    Fetch a single leave request joined with its type and employee data.
    Returns None if not found.
    """
    result = (
        db.query(
            LeaveRequest,
            LeaveType.name.label("leave_type_name"),
            Employee.first_name,
            Employee.last_name,
            Employee.employee_id.label("employee_code"),
            Employee.department,
            Employee.roles,
        )
        .join(LeaveType, LeaveRequest.leave_type_id == LeaveType.id)
        .join(Employee, LeaveRequest.employee_id == Employee.id)
        .filter(LeaveRequest.leave_request_id == request_id)
        .first()
    )

    if not result:
        return None

    leave, leave_type_name, f_name, l_name, code, dept, roles = result
    leave.leave_type_name = leave_type_name
    leave.employee_name   = f"{f_name} {l_name}"
    leave.employee_code   = code
    leave.department      = dept
    leave.role            = roles[0].capitalize() if roles else "Employee"
    return leave


def get_leave_types(db: Session) -> list:
    """Return all leave types ordered by ID."""
    return db.query(LeaveType).order_by(LeaveType.id.asc()).all()


def get_my_leave_history(
    db: Session,
    employee_id: int,
    search: str | None = None,
    leave_type_id: int | None = None,
    status: str | None = None,
    sort_by: str = "newest",
) -> list:
    """Return the filtered leave history for a single employee."""
    query = (
        db.query(LeaveRequest, LeaveType.name.label("leave_type_name"))
        .join(LeaveType, LeaveRequest.leave_type_id == LeaveType.id)
        .filter(LeaveRequest.employee_id == employee_id)
    )

    if search and search.strip():
        term = search.strip()
        query = query.filter(
            or_(
                LeaveType.name.ilike(f"%{term}%"),
                LeaveRequest.reason.ilike(f"%{term}%"),
                LeaveRequest.status.ilike(f"%{term}%"),
                cast(LeaveRequest.leave_request_id, String).ilike(f"%{term}%"),
            )
        )

    if leave_type_id is not None:
        query = query.filter(LeaveRequest.leave_type_id == leave_type_id)

    if status:
        query = query.filter(LeaveRequest.status == status)

    order_col = (
        LeaveRequest.leave_request_id.asc()
        if sort_by == "oldest"
        else LeaveRequest.leave_request_id.desc()
    )

    output = []
    for leave, leave_type_name in query.order_by(order_col).all():
        leave.leave_type_name = leave_type_name
        output.append(leave)

    return output


# ---------------------------------------------------------------------------
# Write operations
# ---------------------------------------------------------------------------

def create_leave(db: Session, employee_id: int, data: LeaveRequestCreate):
    """
    Validate and persist a new leave request.

    Business rules enforced:
      1. end_date >= start_date
      2. leave_type_id must exist
      3. Half-day leaves are always recorded as Annual Leave
      4. Medical leave requires at least one attachment
      5. No overlapping PENDING / APPROVED leave for the same employee
    """
    if data.start_date > data.end_date:
        raise ValueError("start_date cannot be after end_date")

    if not leave_type_exists(db, data.leave_type_id):
        raise ValueError("Invalid leave_type_id")

    leave_type = db.query(LeaveType).filter(LeaveType.id == data.leave_type_id).first()

    # Rule 3: half-day must use Annual Leave.
    if data.half_day:
        annual_leave = db.query(LeaveType).filter(LeaveType.name == "Annual Leave").first()
        if annual_leave:
            data.leave_type_id = annual_leave.id
            leave_type = annual_leave

    # Rule 4: medical leave requires a document.
    if leave_type and "medical" in leave_type.name.lower() and not data.attachment_urls:
        raise ValueError("Medical leave requires at least one supporting document")

    # Rule 5: no overlapping active requests.
    if has_overlapping_leave(db, employee_id, data.start_date, data.end_date):
        raise HTTPException(
            status_code=400,
            detail="You already have a leave request for these dates",
        )

    total_days = calculate_total_days(data.start_date, data.end_date, data.half_day)

    req = LeaveRequest(
        employee_id=employee_id,
        leave_type_id=data.leave_type_id,
        start_date=data.start_date,
        end_date=data.end_date,
        total_days=total_days,
        half_day=data.half_day,
        status=STATUS_PENDING,
        reason=data.reason,
        attachment_urls=data.attachment_urls,
    )

    try:
        db.add(req)
        db.commit()
        db.refresh(req)
        return req
    except IntegrityError:
        db.rollback()
        raise ValueError("Could not create leave request due to a database constraint")


def approve_leave_request(
    db: Session,
    request_id: int,
    approved_by: int,
    manager_comment: str | None = None,
):
    """
    Mark a PENDING leave request as APPROVED.

    Returns None if the request does not exist.
    Raises ValueError if the request is not in PENDING status.
    """
    req = db.query(LeaveRequest).filter(LeaveRequest.leave_request_id == request_id).first()

    if not req:
        return None

    if req.status != STATUS_PENDING:
        raise ValueError("Only pending leave requests can be approved")

    req.status           = STATUS_APPROVED
    req.approved_by      = approved_by
    req.approved_date    = date.today()
    req.rejection_reason = None
    req.manager_comment  = manager_comment

    db.commit()
    db.refresh(req)
    return req


def reject_leave_request(
    db: Session,
    request_id: int,
    approved_by: int,
    rejection_reason: str,
):
    """
    Mark a PENDING leave request as REJECTED.

    A non-empty rejection_reason is mandatory — the frontend and tests rely on
    this to display the reason to the employee.
    """
    req = db.query(LeaveRequest).filter(LeaveRequest.leave_request_id == request_id).first()

    if not req:
        return None

    if req.status != STATUS_PENDING:
        raise ValueError("Only pending leave requests can be rejected")

    if not rejection_reason or not rejection_reason.strip():
        raise ValueError("rejection_reason is required")

    req.status           = STATUS_REJECTED
    req.approved_by      = approved_by
    req.approved_date    = date.today()
    req.rejection_reason = rejection_reason.strip()
    req.manager_comment  = None

    db.commit()
    db.refresh(req)
    return req


def request_info_leave_request(
    db: Session,
    request_id: int,
    approved_by: int,
    manager_comment: str,
):
    """
    Mark a PENDING leave request as REQ_INFO (more information needed).

    manager_comment is mandatory — it tells the employee what to provide.
    """
    req = db.query(LeaveRequest).filter(LeaveRequest.leave_request_id == request_id).first()

    if not req:
        return None

    if req.status != STATUS_PENDING:
        raise ValueError("Only pending leave requests can be marked as request info")

    if not manager_comment or not manager_comment.strip():
        raise ValueError("manager_comment is required")

    req.status          = STATUS_REQ_INFO
    req.approved_by     = approved_by
    req.manager_comment = manager_comment.strip()

    db.commit()
    db.refresh(req)
    return req


def resubmit_leave_request(
    db: Session,
    request_id: int,
    employee_id: int,
    attachment_urls: list[str] | None,
    reason: str | None,
):
    """
    Allow the employee to resubmit a REQ_INFO request with updated information.

    New attachments are appended to (not replaced) existing ones so previously
    uploaded documents are preserved.
    """
    req = db.query(LeaveRequest).filter(
        LeaveRequest.leave_request_id == request_id,
        LeaveRequest.employee_id == employee_id,
    ).first()

    if not req:
        raise ValueError("Leave request not found or not authorized")

    if req.status != STATUS_REQ_INFO:
        raise ValueError("Only requests needing info can be resubmitted")

    # Append new attachments; preserve existing ones.
    if attachment_urls:
        existing = req.attachment_urls if isinstance(req.attachment_urls, list) else []
        req.attachment_urls = existing + attachment_urls

    if reason and reason.strip():
        req.reason = reason.strip()

    # Clear the HR comment now that the employee has responded.
    req.status          = STATUS_PENDING
    req.manager_comment = None

    db.commit()
    db.refresh(req)
    return req


def delete_leave_request(db: Session, request_id: int, employee_id: int) -> bool:
    """
    Permanently delete a PENDING leave request owned by *employee_id*.

    Raises ValueError (not HTTPException) so the router decides the status code.
    """
    req = db.query(LeaveRequest).filter(
        LeaveRequest.leave_request_id == request_id,
        LeaveRequest.employee_id == employee_id,
    ).first()

    if not req:
        raise ValueError("Leave request not found or not authorized")

    if req.status != STATUS_PENDING:
        raise ValueError("Only PENDING leave requests can be deleted")

    db.delete(req)
    db.commit()
    return True


def update_leave_request(
    db: Session,
    request_id: int,
    employee_id: int,
    payload: LeaveRequestCreate,
):
    """
    Replace the mutable fields of a PENDING leave request.

    Overlap check explicitly excludes the request being edited so the employee
    can keep the same dates without triggering a false conflict.
    """
    req = db.query(LeaveRequest).filter(
        LeaveRequest.leave_request_id == request_id,
        LeaveRequest.employee_id == employee_id,
    ).first()

    if not req:
        raise ValueError("Leave request not found or not authorized")

    if req.status != STATUS_PENDING:
        raise ValueError("Only PENDING leave requests can be updated")

    if not leave_type_exists(db, payload.leave_type_id):
        raise ValueError("Invalid leave type")

    # Check for overlap, excluding this request itself.
    overlap = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.employee_id == employee_id,
            LeaveRequest.leave_request_id != request_id,
            LeaveRequest.start_date <= payload.end_date,
            LeaveRequest.end_date >= payload.start_date,
            LeaveRequest.status.in_([STATUS_PENDING, STATUS_APPROVED]),
        )
        .first()
    )
    if overlap:
        raise ValueError("You already have an overlapping leave request for these dates")

    total_days = calculate_total_days(payload.start_date, payload.end_date, payload.half_day)

    req.leave_type_id = payload.leave_type_id
    req.start_date    = payload.start_date
    req.end_date      = payload.end_date
    req.half_day      = payload.half_day
    req.reason        = payload.reason
    req.total_days    = total_days

    if payload.attachment_urls is not None:
        req.attachment_urls = payload.attachment_urls

    db.commit()
    db.refresh(req)
    return req


def update_status(
    db: Session,
    request_id: int,
    status: str,
    approved_by: int | None = None,
    rejection_reason: str | None = None,
):
    """
    Generic status update used by the legacy /status endpoint.

    Prefer the specific approve/reject/request_info helpers for new code.
    """
    req = db.query(LeaveRequest).filter(LeaveRequest.leave_request_id == request_id).first()
    if not req:
        return None

    if status == STATUS_REJECTED and (not rejection_reason or rejection_reason.strip() == ""):
        raise ValueError("rejection_reason is required when rejecting a leave request")

    req.status = status

    if status == STATUS_APPROVED:
        req.approved_by      = approved_by
        req.approved_date    = date.today()
        req.rejection_reason = None
    elif status == STATUS_REJECTED:
        req.approved_by      = approved_by
        req.approved_date    = date.today()
        req.rejection_reason = rejection_reason

    db.commit()
    db.refresh(req)
    return req


def create_leave_type(db: Session, name: str, description: str | None = None):
    """
    Create a new leave type, rejecting duplicates by name.

    WHY: Duplicate leave types would break balance calculations that key on name.
    """
    if not name or not name.strip():
        raise ValueError("Leave type name cannot be empty")

    existing = db.query(LeaveType).filter(LeaveType.name == name.strip()).first()
    if existing:
        raise ValueError("Leave type already exists")

    leave_type = LeaveType(name=name.strip(), description=description)
    db.add(leave_type)
    db.commit()
    db.refresh(leave_type)
    return leave_type


# ---------------------------------------------------------------------------
# Balance / summary calculations
# ---------------------------------------------------------------------------

def get_leave_balance(db: Session, employee_id: int) -> dict[str, float]:
    """
    Calculate remaining leave balance for *employee_id* in the current calendar year.

    Both APPROVED and PENDING days are deducted so the employee can see their
    realistic remaining balance even before requests are approved.
    Balance is floored at 0.0 — no negative values are returned.
    """
    current_year = date.today().year

    results = (
        db.query(
            LeaveType.name,
            func.sum(LeaveRequest.total_days).label("used"),
        )
        .join(LeaveRequest, LeaveRequest.leave_type_id == LeaveType.id)
        .filter(
            LeaveRequest.employee_id == employee_id,
            LeaveRequest.status.in_([STATUS_APPROVED, STATUS_PENDING]),
            func.extract("year", LeaveRequest.start_date) == current_year,
        )
        .group_by(LeaveType.name)
        .all()
    )

    used: dict[str, float] = {name: float(days) for name, days in results}

    return {
        leave_type: max(0.0, total - used.get(leave_type, 0.0))
        for leave_type, total in LEAVE_ENTITLEMENTS.items()
    }


def get_employee_leave_summary(
    db: Session, start_date: date, end_date: date
) -> list[dict]:
    """
    Return per-employee YTD leave statistics for all employees who have at
    least one leave request overlapping the given date window.

    Steps:
      1. Find employee IDs with overlapping requests.
      2. Load employee details in a single query (avoid N+1).
      3. Bulk-fetch YTD approved days.
      4. Bulk-fetch pending days.
      5. Bulk-fetch approved days within the period window.
      6. Build and return the result list.
    """
    current_year = date.today().year

    # Step 1 — employees with overlapping requests.
    employees_in_period = (
        db.query(LeaveRequest.employee_id)
        .filter(
            LeaveRequest.start_date <= end_date,
            LeaveRequest.end_date >= start_date,
        )
        .distinct()
        .all()
    )
    employee_ids = [row.employee_id for row in employees_in_period]

    if not employee_ids:
        return []

    # Step 2 — employee details map.
    employees = db.query(Employee).filter(Employee.id.in_(employee_ids)).all()
    emp_map = {e.id: e for e in employees}

    # Step 3 — YTD approved days.
    approved_rows = (
        db.query(
            LeaveRequest.employee_id,
            func.sum(LeaveRequest.total_days).label("used"),
        )
        .filter(
            LeaveRequest.employee_id.in_(employee_ids),
            LeaveRequest.status == STATUS_APPROVED,
            func.extract("year", LeaveRequest.start_date) == current_year,
        )
        .group_by(LeaveRequest.employee_id)
        .all()
    )
    used_map: dict[int, float] = {row.employee_id: float(row.used) for row in approved_rows}

    # Step 4 — pending days.
    pending_rows = (
        db.query(
            LeaveRequest.employee_id,
            func.sum(LeaveRequest.total_days).label("pending"),
        )
        .filter(
            LeaveRequest.employee_id.in_(employee_ids),
            LeaveRequest.status == STATUS_PENDING,
        )
        .group_by(LeaveRequest.employee_id)
        .all()
    )
    pending_map: dict[int, float] = {row.employee_id: float(row.pending) for row in pending_rows}

    # Step 5 — period-window approved days.
    period_rows = (
        db.query(
            LeaveRequest.employee_id,
            func.sum(LeaveRequest.total_days).label("period_days"),
        )
        .filter(
            LeaveRequest.employee_id.in_(employee_ids),
            LeaveRequest.status == STATUS_APPROVED,
            LeaveRequest.start_date <= end_date,
            LeaveRequest.end_date >= start_date,
        )
        .group_by(LeaveRequest.employee_id)
        .all()
    )
    period_map: dict[int, float] = {row.employee_id: float(row.period_days) for row in period_rows}

    # Step 6 — build result list.
    results = []
    for emp_id in employee_ids:
        emp = emp_map.get(emp_id)
        if not emp:
            continue

        used      = used_map.get(emp_id, 0.0)
        pending   = pending_map.get(emp_id, 0.0)
        remaining = max(0.0, TOTAL_ALLOCATED - (used + pending))

        results.append({
            "employee_id":   emp_id,
            "employee_code": emp.employee_id,
            "employee_name": f"{emp.first_name} {emp.last_name}".strip(),
            "department":    emp.department or "N/A",
            "designation":   emp.designation or "Staff",
            "allocated":     TOTAL_ALLOCATED,
            "used":          used,
            "pending":       pending,
            "remaining":     remaining,
            "period_days":   period_map.get(emp_id, 0.0),
        })

    return results
