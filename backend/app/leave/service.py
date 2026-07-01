from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import date
from sqlalchemy import or_, cast, String, func, extract

from app.leave.models import LeaveRequest, LeaveType, LeaveEntitlement, EmployeeLeaveEntitlement
from app.leave.schemas import LeaveRequestCreate

from fastapi import HTTPException

import logging
_notif_logger = logging.getLogger(__name__)


TEAM_MEMBERS = {
    2: [1, 3],
    4: [1, 2, 3],
}


def get_team_members(manager_id: int) -> list[int]:
    return TEAM_MEMBERS.get(manager_id, [])


def calculate_total_days(db: Session, start_date: date, end_date: date, half_day: bool) -> float:
    if start_date > end_date:
        raise ValueError("Invalid date range")

    from app.calendar_holidays.models import Holiday
    from datetime import timedelta

    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")
    holidays_in_range = db.query(Holiday.date).filter(
        Holiday.date >= start_str,
        Holiday.date <= end_str
    ).all()
    holiday_dates = {h[0] for h in holidays_in_range}

    current_date = start_date
    total_days = 0.0
    while current_date <= end_date:
        # Check if weekend (Saturday=5, Sunday=6)
        is_weekend = current_date.weekday() >= 5
        # Check if holiday
        is_holiday = current_date.strftime("%Y-%m-%d") in holiday_dates

        if not is_weekend and not is_holiday:
            total_days += 1.0
        current_date += timedelta(days=1)

    if half_day:
        if start_date != end_date:
            raise ValueError("Half day leave must be for a single day only")
        return 0.5 if total_days > 0 else 0.0

    return total_days



def leave_type_exists(db: Session, leave_type_id: int) -> bool:
    leave_type = db.query(LeaveType).filter(LeaveType.id == leave_type_id).first()
    return leave_type is not None


def _used_days(db: Session, employee_id: int, leave_type_id: int, year: int, statuses: list[str],
               exclude_request_id: int | None = None) -> float:
    """Sum of total_days for the employee/type/year in the given statuses."""
    q = (
        db.query(func.coalesce(func.sum(LeaveRequest.total_days), 0.0))
        .filter(
            LeaveRequest.employee_id == employee_id,
            LeaveRequest.leave_type_id == leave_type_id,
            LeaveRequest.status.in_(statuses),
            extract("year", LeaveRequest.start_date) == year,
        )
    )
    if exclude_request_id is not None:
        q = q.filter(LeaveRequest.leave_request_id != exclude_request_id)
    return float(q.scalar() or 0.0)


def _employee_role_id(db: Session, employee_id: int) -> int | None:
    """Resolve the role of the user linked to an employee record."""
    from app.employees.models import Employee
    from app.auth.models import User

    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp or not emp.user_id:
        return None
    user = db.query(User).filter(User.id == emp.user_id).first()
    if not user:
        return None
    if user.role_id:
        return user.role_id
    if user.roles:
        return user.roles[0].id
    return None


def _entitlement_for(db: Session, employee_id: int, leave_type: LeaveType,
                     role_id: int | None = None) -> float | None:
    """
    Entitlement for one employee/type: 
    1. Employee-specific override if configured
    2. Per-role entitlement if HR has configured one
    3. Type's default_days. None = unlimited.
    """
    # 1. Employee-specific override
    emp_override = (
        db.query(EmployeeLeaveEntitlement)
        .filter(
            EmployeeLeaveEntitlement.employee_id == employee_id,
            EmployeeLeaveEntitlement.leave_type_id == leave_type.id,
        )
        .first()
    )
    if emp_override is not None:
        return float(emp_override.days)

    # 2. Per-role entitlement
    if role_id is None:
        role_id = _employee_role_id(db, employee_id)
    if role_id is not None:
        row = (
            db.query(LeaveEntitlement)
            .filter(
                LeaveEntitlement.role_id == role_id,
                LeaveEntitlement.leave_type_id == leave_type.id,
            )
            .first()
        )
        if row is not None:
            return float(row.days)
            
    # 3. Default days
    return float(leave_type.default_days) if leave_type.default_days is not None else None


def get_leave_balances(db: Session, employee_id: int) -> list[dict]:
    """
    Per-type balance for the current year:
      remaining = entitlement − approved − pending days.
    Pending/request-info days are subtracted too so the figure matches what
    the employee can actually still request (see _enforce_balance).
    Entitlement is the per-role value when configured, else the type
    default. Types with no entitlement report remaining=None (unlimited).
    """
    year = date.today().year
    role_id = _employee_role_id(db, employee_id)
    balances = []
    for lt in db.query(LeaveType).order_by(LeaveType.id).all():
        entitlement = _entitlement_for(db, employee_id, lt, role_id=role_id)
        used = _used_days(db, employee_id, lt.id, year, ["APPROVED"])
        pending = _used_days(db, employee_id, lt.id, year, ["PENDING", "REQ_INFO"])
        remaining = None
        if entitlement is not None:
            remaining = max(entitlement - used - pending, 0.0)
        balances.append({
            "leave_type_id": lt.id,
            "leave_type_name": lt.name,
            "entitlement": entitlement,
            "used_days": used,
            "pending_days": pending,
            "remaining": remaining,
        })
    return balances


def _enforce_balance(db: Session, employee_id: int, leave_type: LeaveType, requested_days: float,
                     start_date: date, exclude_request_id: int | None = None) -> None:
    """Reject the request if it exceeds the remaining entitlement for that year."""
    if leave_type is None:
        return
    entitlement = _entitlement_for(db, employee_id, leave_type)
    if entitlement is None:
        return
    year = start_date.year
    # Count committed days = approved + pending + request-info. Counting the
    # unapproved requests too prevents an employee stacking several PENDING
    # requests that individually fit but together blow past the entitlement.
    committed = _used_days(db, employee_id, leave_type.id, year,
                           ["APPROVED", "PENDING", "REQ_INFO"],
                           exclude_request_id=exclude_request_id)
    remaining = entitlement - committed
    if requested_days > remaining:
        raise ValueError(
            f"Insufficient {leave_type.name} leave balance: "
            f"{max(remaining, 0.0):g} day(s) remaining, {requested_days:g} requested"
        )


def get_leave_entitlements(db: Session) -> dict:
    """Roles × leave types matrix for the entitlement management UI."""
    from app.roles.models import Role

    roles = [
        r for r in db.query(Role).order_by(Role.id).all()
        if not (r.description or "").startswith("LEGACY:")
    ]
    types = db.query(LeaveType).order_by(LeaveType.id).all()
    overrides = {
        (e.role_id, e.leave_type_id): float(e.days)
        for e in db.query(LeaveEntitlement).all()
    }

    entries = []
    for role in roles:
        for lt in types:
            override = overrides.get((role.id, lt.id))
            entries.append({
                "role_id": role.id,
                "role_name": role.role_name,
                "leave_type_id": lt.id,
                "leave_type_name": lt.name,
                "days": override if override is not None
                        else (float(lt.default_days) if lt.default_days is not None else None),
                "is_override": override is not None,
            })
    return {
        "roles": [{"id": r.id, "name": r.role_name} for r in roles],
        "leave_types": [
            {"id": t.id, "name": t.name, "default_days": t.default_days} for t in types
        ],
        "entries": entries,
    }


def set_leave_entitlements(db: Session, items: list) -> dict:
    """Upsert per-role entitlements. days=None removes the override."""
    from app.roles.models import Role

    for item in items:
        role = db.query(Role).filter(Role.id == item.role_id).first()
        lt = db.query(LeaveType).filter(LeaveType.id == item.leave_type_id).first()
        if not role or not lt:
            raise ValueError(f"Invalid role_id {item.role_id} or leave_type_id {item.leave_type_id}")
        if item.days is not None and item.days < 0:
            raise ValueError("Entitlement days cannot be negative")

        row = (
            db.query(LeaveEntitlement)
            .filter(
                LeaveEntitlement.role_id == item.role_id,
                LeaveEntitlement.leave_type_id == item.leave_type_id,
            )
            .first()
        )
        if item.days is None:
            if row:
                db.delete(row)
        elif row:
            row.days = item.days
        else:
            db.add(LeaveEntitlement(
                role_id=item.role_id,
                leave_type_id=item.leave_type_id,
                days=item.days,
            ))
    db.commit()
    return get_leave_entitlements(db)


def get_employee_leave_entitlements(db: Session, employee_id: int) -> dict:
    from app.employees.models import Employee
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise ValueError("Employee not found")

    types = db.query(LeaveType).order_by(LeaveType.id).all()
    overrides = {
        e.leave_type_id: float(e.days)
        for e in db.query(EmployeeLeaveEntitlement).filter(EmployeeLeaveEntitlement.employee_id == employee_id).all()
    }

    entries = []
    for lt in types:
        override = overrides.get(lt.id)
        entries.append({
            "leave_type_id": lt.id,
            "leave_type_name": lt.name,
            "days": override if override is not None else None,
            "is_override": override is not None,
        })
        
    return {
        "employee_id": employee_id,
        "employee_name": f"{emp.first_name} {emp.last_name}",
        "leave_types": [
            {"id": t.id, "name": t.name, "default_days": t.default_days} for t in types
        ],
        "entries": entries,
    }

def set_employee_leave_entitlements(db: Session, employee_id: int, items: list) -> dict:
    from app.employees.models import Employee
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise ValueError("Employee not found")

    for item in items:
        lt = db.query(LeaveType).filter(LeaveType.id == item.leave_type_id).first()
        if not lt:
            raise ValueError(f"Invalid leave_type_id {item.leave_type_id}")
        if item.days is not None and item.days < 0:
            raise ValueError("Entitlement days cannot be negative")

        row = (
            db.query(EmployeeLeaveEntitlement)
            .filter(
                EmployeeLeaveEntitlement.employee_id == employee_id,
                EmployeeLeaveEntitlement.leave_type_id == item.leave_type_id,
            )
            .first()
        )
        if item.days is None:
            if row:
                db.delete(row)
        elif row:
            row.days = item.days
        else:
            db.add(EmployeeLeaveEntitlement(
                employee_id=employee_id,
                leave_type_id=item.leave_type_id,
                days=item.days,
            ))
    db.commit()
    return get_employee_leave_entitlements(db, employee_id)

def has_overlapping_leave(db: Session, employee_id: int, start_date: date, end_date: date) -> bool:
    overlap = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.employee_id == employee_id,
            LeaveRequest.start_date <= end_date,
            LeaveRequest.end_date >= start_date,
            LeaveRequest.status.in_(["PENDING", "APPROVED"])
        )
        .first()
    )
    return overlap is not None


def get_pending_requests(db: Session, user: dict):
    role = user.get("role", "").lower()

    query = (
        db.query(LeaveRequest, LeaveType.name.label("leave_type_name"))
        .join(LeaveType, LeaveRequest.leave_type_id == LeaveType.id)
        .filter(LeaveRequest.status == "PENDING")
    )

    # HR → see all except their own
    if role == "hr":
        query = query.filter(LeaveRequest.employee_id != user["id"])
    else:
        return []

    results = query.order_by(LeaveRequest.leave_request_id.desc()).all()

    output = []
    for leave, leave_type_name in results:
        leave.leave_type_name = leave_type_name
        output.append(leave)

    return output
def get_leave_history(
    db: Session,
    user: dict,
    search: str | None = None,
    leave_type_id: int | None = None,
    status: str | None = None,
    sort_by: str = "newest",
):
    query = db.query(LeaveRequest, LeaveType.name.label("leave_type_name")).join(
        LeaveType, LeaveRequest.leave_type_id == LeaveType.id
    )

    if user["role"] == "employee":
        query = query.filter(LeaveRequest.employee_id == user["id"])
    elif user["role"] == "hr":
        query = query.filter(LeaveRequest.employee_id == user["id"])
    elif user["role"] == "manager":
        team = get_team_members(user["id"])
        query = query.filter(
            or_(
                LeaveRequest.employee_id == user["id"],
                LeaveRequest.employee_id.in_(team),
            )
        )

    if search:
        search = search.strip()
        if search:
            query = query.filter(
                or_(
                    LeaveType.name.ilike(f"%{search}%"),
                    LeaveRequest.reason.ilike(f"%{search}%"),
                    LeaveRequest.status.ilike(f"%{search}%"),
                    cast(LeaveRequest.leave_request_id, String).ilike(f"%{search}%")
                )
            )

    if leave_type_id is not None:
        query = query.filter(LeaveRequest.leave_type_id == leave_type_id)

    if status:
        query = query.filter(LeaveRequest.status == status)

    if sort_by == "oldest":
        query = query.order_by(LeaveRequest.start_date.asc())
    else:
        query = query.order_by(LeaveRequest.start_date.desc())

    results = query.all()

    output = []
    for leave, leave_type_name in results:
        leave.leave_type_name = leave_type_name
        output.append(leave)

    return output


def create_leave(db: Session, employee_id: int, data: LeaveRequestCreate, auto_approve: bool = False):
    if data.start_date > data.end_date:
        raise ValueError("start_date cannot be after end_date")

    if not leave_type_exists(db, data.leave_type_id):
        raise ValueError("Invalid leave_type_id")

    leave_type = db.query(LeaveType).filter(LeaveType.id == data.leave_type_id).first()

    if leave_type and "medical" in leave_type.name.lower() and not data.attachment_urls:
        raise ValueError("Medical leave requires at least one supporting document")

    if has_overlapping_leave(db, employee_id, data.start_date, data.end_date):
        raise HTTPException(status_code=400,detail="You already have a leave request for these dates")

    total_days = calculate_total_days(db, data.start_date, data.end_date, data.half_day)

    _enforce_balance(db, employee_id, leave_type, total_days, data.start_date)

    req = LeaveRequest(
        employee_id=employee_id,
        leave_type_id=data.leave_type_id,
        start_date=data.start_date,
        end_date=data.end_date,
        total_days=total_days,
        half_day=data.half_day,
        status="APPROVED" if auto_approve else "PENDING",
        reason=data.reason,
        attachment_urls=data.attachment_urls,
    )

    try:
        db.add(req)
        db.commit()
        db.refresh(req)

        # ── Notify leave approvers ──────────────────────────────────────
        if not auto_approve:
            try:
                from app.notifications.service import notify_permission, get_employee_name
                emp_name = get_employee_name(db, employee_id)
                leave_type_name = leave_type.name if leave_type else "leave"
                notify_permission(
                    db, "leave:approve",
                    f"{emp_name} requested {leave_type_name} leave ({data.start_date} \u2013 {data.end_date})",
                    category="leave", type="info", link="/approval",
                    entity_type="leave_request", entity_id=str(req.leave_request_id),
                    exclude_employee_id=employee_id,
                )
                db.commit()
            except Exception as e:
                _notif_logger.error(f"[Leave] Notification failed for create_leave: {e}")

        return req
    except IntegrityError:
        db.rollback()
        raise ValueError("Could not create leave request")


def my_requests(db: Session, employee_id: int):
    return (
        db.query(LeaveRequest)
        .filter(LeaveRequest.employee_id == employee_id)
        .order_by(LeaveRequest.leave_request_id.desc())
        .all()
    )


def pending_requests(db: Session):
    return (
        db.query(LeaveRequest)
        .filter(LeaveRequest.status == "PENDING")
        .order_by(LeaveRequest.leave_request_id.desc())
        .all()
    )


def get_leave_request_by_id(db: Session, request_id: int):
    result = (
        db.query(LeaveRequest, LeaveType.name.label("leave_type_name"))
        .join(LeaveType, LeaveRequest.leave_type_id == LeaveType.id)
        .filter(LeaveRequest.leave_request_id == request_id)
        .first()
    )

    if not result:
        return None

    leave, leave_type_name = result
    leave.leave_type_name = leave_type_name
    return leave


def approve_leave_request(
    db: Session,
    request_id: int,
    approved_by: int,
    manager_comment: str | None = None,
):
    req = db.query(LeaveRequest).filter(LeaveRequest.leave_request_id == request_id).first()

    if not req:
        return None

    if req.status != "PENDING":
        raise ValueError("Only pending leave requests can be approved")

    req.status = "APPROVED"
    req.approved_by = approved_by
    req.approved_date = date.today()
    req.rejection_reason = None
    req.manager_comment = manager_comment

    db.commit()
    db.refresh(req)

    # ── Notify requesting employee ────────────────────────────────────
    try:
        from app.notifications.service import notify_employee
        from app.leave.models import LeaveType as _LT
        lt = db.query(_LT).filter(_LT.id == req.leave_type_id).first()
        lt_name = lt.name if lt else "leave"
        notify_employee(
            db, req.employee_id,
            f"Your {lt_name} leave request was approved",
            category="leave", type="success", link="/leave-history",
            entity_type="leave_request", entity_id=str(req.leave_request_id),
        )
        db.commit()
    except Exception as e:
        _notif_logger.error(f"[Leave] Notification failed for approve: {e}")

    return req


def reject_leave_request(
    db: Session,
    request_id: int,
    approved_by: int,
    rejection_reason: str,
):
    req = db.query(LeaveRequest).filter(LeaveRequest.leave_request_id == request_id).first()

    if not req:
        return None

    if req.status != "PENDING":
        raise ValueError("Only pending leave requests can be rejected")

    if not rejection_reason or not rejection_reason.strip():
        raise ValueError("rejection_reason is required")

    req.status = "REJECTED"
    req.approved_by = approved_by
    req.approved_date = date.today()
    req.rejection_reason = rejection_reason.strip()
    req.manager_comment = None

    db.commit()
    db.refresh(req)

    # ── Notify requesting employee ────────────────────────────────────
    try:
        from app.notifications.service import notify_employee
        from app.leave.models import LeaveType as _LT
        lt = db.query(_LT).filter(_LT.id == req.leave_type_id).first()
        lt_name = lt.name if lt else "leave"
        notify_employee(
            db, req.employee_id,
            f"Your {lt_name} leave request was rejected: {rejection_reason.strip()}",
            category="leave", type="error", link="/leave-history",
            entity_type="leave_request", entity_id=str(req.leave_request_id),
        )
        db.commit()
    except Exception as e:
        _notif_logger.error(f"[Leave] Notification failed for reject: {e}")

    return req


def request_info_leave_request(
    db: Session,
    request_id: int,
    approved_by: int,
    manager_comment: str,
):
    req = db.query(LeaveRequest).filter(LeaveRequest.leave_request_id == request_id).first()

    if not req:
        return None

    if req.status != "PENDING":
        raise ValueError("Only pending leave requests can be marked as request info")

    if not manager_comment or not manager_comment.strip():
        raise ValueError("manager_comment is required")

    req.status = "REQ_INFO"
    req.approved_by = approved_by
    req.manager_comment = manager_comment.strip()

    db.commit()
    db.refresh(req)

    # ── Notify requesting employee ────────────────────────────────────
    try:
        from app.notifications.service import notify_employee
        notify_employee(
            db, req.employee_id,
            f"More info needed on your leave request: {manager_comment.strip()}",
            category="leave", type="warning", link="/leave-history",
            entity_type="leave_request", entity_id=str(req.leave_request_id),
        )
        db.commit()
    except Exception as e:
        _notif_logger.error(f"[Leave] Notification failed for request_info: {e}")

    return req


def resubmit_leave_request(
    db: Session,
    request_id: int,
    employee_id: int,
    attachment_urls: list[str] | None,
    reason: str | None,
):
    req = db.query(LeaveRequest).filter(
        LeaveRequest.leave_request_id == request_id,
        LeaveRequest.employee_id == employee_id
    ).first()

    if not req:
        raise ValueError("Leave request not found or not authorized")

    if req.status != "REQ_INFO":
        raise ValueError("Only requests needing info can be resubmitted")

    # Append new attachments to existing ones
    if attachment_urls:
        existing_urls = req.attachment_urls if isinstance(req.attachment_urls, list) else []
        req.attachment_urls = existing_urls + attachment_urls

    if reason is not None and reason.strip():
        req.reason = reason.strip()

    req.status = "PENDING"
    req.manager_comment = None  # Clear HR comment since they are replying

    db.commit()
    db.refresh(req)

    # ── Notify leave approvers ──────────────────────────────────────
    try:
        from app.notifications.service import notify_permission, get_employee_name
        emp_name = get_employee_name(db, employee_id)
        notify_permission(
            db, "leave:approve",
            f"{emp_name} resubmitted a leave request",
            category="leave", type="info", link="/approval",
            entity_type="leave_request", entity_id=str(req.leave_request_id),
            exclude_employee_id=employee_id,
        )
        db.commit()
    except Exception as e:
        _notif_logger.error(f"[Leave] Notification failed for resubmit: {e}")

    return req


def update_status(
    db: Session,
    request_id: int,
    status: str,
    approved_by: int | None = None,
    rejection_reason: str | None = None,
):
    req = db.query(LeaveRequest).filter(LeaveRequest.leave_request_id == request_id).first()
    if not req:
        return None

    if status == "REJECTED" and (rejection_reason is None or rejection_reason.strip() == ""):
        raise ValueError("rejection_reason is required when rejecting a leave request")

    req.status = status

    if status == "APPROVED":
        req.approved_by = approved_by
        req.approved_date = date.today()
        req.rejection_reason = None

    elif status == "REJECTED":
        req.approved_by = approved_by
        req.approved_date = date.today()
        req.rejection_reason = rejection_reason

    db.commit()
    db.refresh(req)

    # ── Notify requesting employee ────────────────────────────────────
    try:
        from app.notifications.service import notify_employee
        notify_employee(
            db, req.employee_id,
            f"Your leave request status changed to {status}",
            category="leave", type="info", link="/leave-history",
            entity_type="leave_request", entity_id=str(req.leave_request_id),
        )
        db.commit()
    except Exception as e:
        _notif_logger.error(f"[Leave] Notification failed for status change: {e}")

    return req

def delete_leave_request(db: Session, request_id: int, employee_id: int):
    req = db.query(LeaveRequest).filter(
        LeaveRequest.leave_request_id == request_id, 
        LeaveRequest.employee_id == employee_id
    ).first()
    if not req:
        raise ValueError("Leave request not found or not authorized")
    if req.status != "PENDING":
        raise ValueError("Only PENDING leave requests can be deleted")
    db.delete(req)
    db.commit()
    return True


def update_leave_request(db: Session, request_id: int, employee_id: int, payload: LeaveRequestCreate):
    req = db.query(LeaveRequest).filter(
        LeaveRequest.leave_request_id == request_id, 
        LeaveRequest.employee_id == employee_id
    ).first()
    
    if not req:
        raise ValueError("Leave request not found or not authorized")
    if req.status != "PENDING":
        raise ValueError("Only PENDING leave requests can be updated")
        
    if not leave_type_exists(db, payload.leave_type_id):
        raise ValueError("Invalid leave type")
        
    # Check for overlapping leave excluding this current request
    overlap = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.employee_id == employee_id,
            LeaveRequest.leave_request_id != request_id,
            LeaveRequest.start_date <= payload.end_date,
            LeaveRequest.end_date >= payload.start_date,
            LeaveRequest.status.in_(["PENDING", "APPROVED"])
        )
        .first()
    )
    if overlap:
        raise ValueError("You already have an overlapping leave request for these dates")

    total_days = calculate_total_days(db, payload.start_date, payload.end_date, payload.half_day)

    leave_type = db.query(LeaveType).filter(LeaveType.id == payload.leave_type_id).first()
    _enforce_balance(db, employee_id, leave_type, total_days, payload.start_date,
                     exclude_request_id=request_id)

    req.leave_type_id = payload.leave_type_id
    req.start_date = payload.start_date
    req.end_date = payload.end_date
    req.half_day = payload.half_day
    req.reason = payload.reason
    if payload.attachment_urls is not None:
        req.attachment_urls = payload.attachment_urls
    req.total_days = total_days

    db.commit()
    db.refresh(req)
    return req


def get_leave_types(db: Session):
    return db.query(LeaveType).order_by(LeaveType.id.asc()).all()


def create_leave_type(db: Session, name: str, description: str | None = None):
    existing = db.query(LeaveType).filter(LeaveType.name == name).first()
    if existing:
        raise ValueError("Leave type already exists")

    leave_type = LeaveType(name=name, description=description)
    db.add(leave_type)
    db.commit()
    db.refresh(leave_type)
    return leave_type


def get_my_leave_history(
    db: Session,
    employee_id: int,
    search: str | None = None,
    leave_type_id: int | None = None,
    status: str | None = None,
    sort_by: str = "newest",
):
    query = db.query(LeaveRequest, LeaveType.name.label("leave_type_name")).join(
        LeaveType, LeaveRequest.leave_type_id == LeaveType.id
    ).filter(
        LeaveRequest.employee_id == employee_id
    )

    if search:
        search = search.strip()
        if search:
            query = query.filter(
                or_(
                    LeaveType.name.ilike(f"%{search}%"),
                    LeaveRequest.reason.ilike(f"%{search}%"),
                    LeaveRequest.status.ilike(f"%{search}%"),
                    cast(LeaveRequest.leave_request_id, String).ilike(f"%{search}%")
                )
            )

    if leave_type_id is not None:
        query = query.filter(LeaveRequest.leave_type_id == leave_type_id)

    if status:
        query = query.filter(LeaveRequest.status == status)

    if sort_by == "oldest":
        query = query.order_by(LeaveRequest.start_date.asc())
    else:
        query = query.order_by(LeaveRequest.start_date.desc())

    results = query.all()

    output = []
    for leave, leave_type_name in results:
        leave.leave_type_name = leave_type_name
        output.append(leave)

    return output