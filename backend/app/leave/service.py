from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import date
from sqlalchemy import or_, cast, String, func, extract

from app.leave.models import LeaveRequest, LeaveType, LeaveEntitlement, EmployeeLeaveEntitlement, LeaveAuditLog
from app.leave.accrual_models import EmployeeLeaveAccrualRule
from app.leave.schemas import LeaveRequestCreate

from fastapi import HTTPException

import logging
_notif_logger = logging.getLogger(__name__)


def get_team_members(db: Session, manager_employee_id: int) -> list[int]:
    """
    Return the employee IDs of all employees in the same department
    as the manager, excluding the manager themselves.
    """
    from app.employees.models import Employee
    manager = db.query(Employee).filter(Employee.id == manager_employee_id).first()
    if not manager or not manager.department_id:
        return []
    teammates = (
        db.query(Employee.id)
        .filter(
            Employee.department_id == manager.department_id,
            Employee.id != manager_employee_id,
            Employee.is_deleted == False,
        )
        .all()
    )
    return [e.id for e in teammates]



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
                     role_id: int | None = None, year: int | None = None) -> float | None:
    """
    Entitlement for one employee/type: 
    1. Employee-specific override if configured
    2. Per-role entitlement if HR has configured one
    3. Type's default_days. None = unlimited.
    """
    base_entitlement: float | None = None
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

    # 1.5. Check if employee is on a fixed term contract (has an end_date)
    from app.employees.models import EmployeeDesignationHistory
    latest_desig = (
        db.query(EmployeeDesignationHistory)
        .filter(EmployeeDesignationHistory.employee_id == employee_id)
        .order_by(EmployeeDesignationHistory.start_date.desc())
        .first()
    )
    if latest_desig is not None and latest_desig.end_date is not None:
        # Fixed-term employees ONLY get leave they are explicitly overridden for
        return 0.0

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
            base_entitlement = float(row.days)

    # 3. Default days
    if base_entitlement is None:
        base_entitlement = float(leave_type.default_days) if leave_type.default_days is not None else None

    # Calculate carry-over for Annual Leave if year is specified (and not recursing)
    if year is not None and base_entitlement is not None and leave_type.name.lower() == 'annual leave':
        prev_entitlement = _entitlement_for(db, employee_id, leave_type, role_id=role_id, year=None)
        if prev_entitlement is not None:
            prev_used = _used_days(db, employee_id, leave_type.id, year - 1, ["APPROVED"])
            prev_remaining = max(prev_entitlement - prev_used, 0.0)
            carry_over = min(prev_remaining, 5.0)  # cap carry-over at 5 days
            base_entitlement += carry_over

    return base_entitlement


def _get_accrual_balance(db: Session, employee_id: int, leave_type_id: int, today: date | None = None) -> dict | None:
    """Compute the accrual-mode balance for one employee/type pair.

    Returns None if no accrual rule exists (caller falls back to flat mode).

    Logic:
      • elapsed_months = full calendar months from period_start up to
        min(today, period_end) — inclusive of the start month.
      • raw_accrued = elapsed_months × days_per_month, optionally capped by total_leaves_cap
      • total_used = APPROVED leaves taken since period_start.
      • If carry_forward_allowed:
          total_balance = max(0, raw_accrued - total_used)
          this_month_balance = total_balance
      • If not carry_forward_allowed:
          this_month_balance = max(0, days_per_month - used_this_month)
          optionally capped by (total_leaves_cap - total_used)
          total_balance = this_month_balance
    """
    if today is None:
        today = date.today()

    rule = (
        db.query(EmployeeLeaveAccrualRule)
        .filter(
            EmployeeLeaveAccrualRule.employee_id == employee_id,
            EmployeeLeaveAccrualRule.leave_type_id == leave_type_id,
        )
        .first()
    )
    if rule is None:
        return None

    # Effective accrual window ceiling
    accrual_end = min(today, rule.period_end) if rule.period_end else today

    # Months elapsed — any started month counts as a full month
    y_diff = accrual_end.year - rule.period_start.year
    m_diff = accrual_end.month - rule.period_start.month
    elapsed_months = max(0, y_diff * 12 + m_diff + 1)  # +1 includes start month

    raw_accrued = elapsed_months * rule.days_per_month

    # Total days approved since period_start
    total_used = float(
        db.query(func.coalesce(func.sum(LeaveRequest.total_days), 0.0))
        .filter(
            LeaveRequest.employee_id == employee_id,
            LeaveRequest.leave_type_id == leave_type_id,
            LeaveRequest.status == "APPROVED",
            LeaveRequest.start_date >= rule.period_start,
        )
        .scalar()
        or 0.0
    )

    if rule.total_leaves_cap is not None:
        raw_accrued = min(raw_accrued, rule.total_leaves_cap)

    total_accrued = raw_accrued

    # Sub-ledger for the current calendar month
    month_start = today.replace(day=1)
    used_this_month = float(
        db.query(func.coalesce(func.sum(LeaveRequest.total_days), 0.0))
        .filter(
            LeaveRequest.employee_id == employee_id,
            LeaveRequest.leave_type_id == leave_type_id,
            LeaveRequest.status == "APPROVED",
            LeaveRequest.start_date >= month_start,
            LeaveRequest.start_date <= today,
        )
        .scalar()
        or 0.0
    )

    if rule.carry_forward_allowed:
        total_balance = max(0.0, total_accrued - total_used)
        this_month_balance = total_balance
    else:
        this_month_earned = rule.days_per_month
        this_month_balance = max(0.0, this_month_earned - used_this_month)
        
        if rule.total_leaves_cap is not None:
            overall_remaining = max(0.0, rule.total_leaves_cap - total_used)
            this_month_balance = min(this_month_balance, overall_remaining)
            
        total_balance = this_month_balance

    return {
        "mode": "accrual",
        "days_per_month": rule.days_per_month,
        "total_accrued": round(total_accrued, 2),
        "total_used": round(total_used, 2),
        "total_balance": round(total_balance, 2),
        "this_month_balance": round(this_month_balance, 2),
    }


def get_leave_balances(db: Session, employee_id: int, year: int | None = None) -> list[dict]:
    """
    Per-type balance for the current year:
    ...
    """
    if year is None:
        year = date.today().year
    today = date.today()
    role_id = _employee_role_id(db, employee_id)
    balances = []
    for lt in db.query(LeaveType).order_by(LeaveType.id).all():
        # --- Accrual mode: check for a monthly accrual rule first ---
        accrual = _get_accrual_balance(db, employee_id, lt.id, today=today)
        if accrual is not None:
            # pending days are still counted from leave requests
            pending = _used_days(db, employee_id, lt.id, year, ["PENDING", "REQ_INFO"])
            balances.append({
                "leave_type_id": lt.id,
                "leave_type_name": lt.name,
                "entitlement": None,        # not applicable in accrual mode
                "used_days": accrual["total_used"],
                "pending_days": pending,
                "remaining": max(0.0, accrual["total_balance"] - pending),  # maps to the widget 'remaining' field
                # accrual-specific extras
                "mode": "accrual",
                "days_per_month": accrual["days_per_month"],
                "total_accrued": accrual["total_accrued"],
                "total_balance": accrual["total_balance"],
                "this_month_balance": accrual["this_month_balance"],
            })
            continue

        # --- Flat mode (existing logic, unchanged) ---
        entitlement = _entitlement_for(db, employee_id, lt, role_id=role_id, year=year)
        if entitlement == 0.0:
            continue  # Hide leave types that the employee is not entitled to

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
            "mode": "flat",
        })
    return balances


def _enforce_balance(db: Session, employee_id: int, leave_type: LeaveType, requested_days: float,
                     start_date: date, exclude_request_id: int | None = None) -> None:
    """Reject the request if it exceeds the remaining balance (accrual or flat)."""
    if leave_type is None:
        return

    # --- Accrual mode: check against dynamically computed total_balance ---
    accrual = _get_accrual_balance(db, employee_id, leave_type.id)
    if accrual is not None:
        # Also count pending/req-info requests as committed so they can't be stacked
        year = start_date.year
        pending_committed = _used_days(
            db, employee_id, leave_type.id, year,
            ["PENDING", "REQ_INFO"],
            exclude_request_id=exclude_request_id,
        )
        available = max(0.0, accrual["total_balance"] - pending_committed)
        if requested_days > available:
            raise ValueError(
                f"Insufficient {leave_type.name} leave balance: "
                f"{available:g} day(s) available (accrual), {requested_days:g} requested"
            )
        return

    # --- Flat mode (existing logic) ---
    year = start_date.year
    entitlement = _entitlement_for(db, employee_id, leave_type, year=year)
    if entitlement is None:
        return
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

    from app.leave.models import EmployeeLeaveAccrualRule
    accrual_rules = {
        r.leave_type_id: r
        for r in db.query(EmployeeLeaveAccrualRule).filter(EmployeeLeaveAccrualRule.employee_id == employee_id).all()
    }

    entries = []
    for lt in types:
        override = overrides.get(lt.id)
        accrual = accrual_rules.get(lt.id)
        
        mode = "accrual" if accrual else "flat"
        
        entries.append({
            "leave_type_id": lt.id,
            "leave_type_name": lt.name,
            "days": override if override is not None else None,
            "is_override": override is not None or accrual is not None,
            "mode": mode,
            "days_per_month": accrual.days_per_month if accrual else None,
            "total_leaves_cap": accrual.total_leaves_cap if accrual else None,
            "carry_forward_allowed": accrual.carry_forward_allowed if accrual else False,
            "period_start": accrual.period_start.isoformat() if accrual and accrual.period_start else None,
            "period_end": accrual.period_end.isoformat() if accrual and accrual.period_end else None,
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

        # Check if days_per_month was explicitly provided in the payload
        if "days_per_month" in item.model_dump(exclude_unset=True):
            from app.leave.models import EmployeeLeaveAccrualRule
            accrual_rule = db.query(EmployeeLeaveAccrualRule).filter(
                EmployeeLeaveAccrualRule.employee_id == employee_id,
                EmployeeLeaveAccrualRule.leave_type_id == item.leave_type_id
            ).first()
            if accrual_rule:
                if item.days_per_month is None:
                    db.delete(accrual_rule)
                else:
                    accrual_rule.days_per_month = item.days_per_month
                    if item.total_leaves_cap is not None:
                        accrual_rule.total_leaves_cap = item.total_leaves_cap
                    accrual_rule.carry_forward_allowed = item.carry_forward_allowed
            elif item.days_per_month is not None:
                # Create a new accrual rule — this is the first time it's being set
                from datetime import date
                db.add(EmployeeLeaveAccrualRule(
                    employee_id=employee_id,
                    leave_type_id=item.leave_type_id,
                    days_per_month=item.days_per_month,
                    period_start=date.today(),
                    total_leaves_cap=item.total_leaves_cap,
                    carry_forward_allowed=item.carry_forward_allowed,
                ))

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


def _attach_employee_info(db: Session, leave) -> None:
    """
    Attach the requesting employee's display fields to a LeaveRequest ORM object
    so approvers see WHO the request is for (name, code, department, role) instead
    of a bare id. LeaveRequest.employee_id is Employee.id. Department comes from the
    employee's department FK and role from the linked user's assigned role
    (authoritative sources, matching the rest of the system).
    """
    from app.employees.models import Employee

    emp = db.query(Employee).filter(Employee.id == leave.employee_id).first()
    if not emp:
        leave.employee_name = f"Employee {leave.employee_id}"
        leave.employee_code = None
        leave.department = None
        leave.role = None
        return

    full_name = f"{emp.first_name or ''} {emp.last_name or ''}".strip()
    leave.employee_name = full_name or f"Employee {leave.employee_id}"
    leave.employee_code = emp.employee_id
    leave.department = emp.department_rel.name if emp.department_rel else None
    user = emp.user
    if user and getattr(user, "roles", None):
        leave.role = user.roles[0].role_name
    elif user:
        leave.role = user.role
    else:
        leave.role = None


def get_pending_requests(db: Session, user: dict):
    role = user.get("role", "").lower()

    query = (
        db.query(LeaveRequest, LeaveType.name.label("leave_type_name"))
        .join(LeaveType, LeaveRequest.leave_type_id == LeaveType.id)
        .filter(LeaveRequest.status.in_(["PENDING", "PENDING_MEDICAL"]))
    )

    # HR → see all except their own self-requested leaves
    if role == "hr":
        query = query.filter(LeaveRequest.employee_id != user["id"])
        # All HR/Admin with can_assign see ALL assigned-pending leaves
        # (including ones they themselves assigned) so the queue is never empty.
        # The approval gate in router.py still prevents the assigner from
        # approving their own assigned leaves (separation of duties).
        if not user.get("can_assign"):
            # Managers (leave:approve but not leave:assign) see only
            # non-assigned leaves from their department team members.
            team = get_team_members(db, user["id"])
            if not team:
                return []
            query = query.filter(
                LeaveRequest.assigned_by.is_(None),
                LeaveRequest.employee_id.in_(team),
            )
    else:
        return []

    results = query.order_by(LeaveRequest.leave_request_id.desc()).all()

    output = []
    for leave, leave_type_name in results:
        leave.leave_type_name = leave_type_name
        _attach_employee_info(db, leave)
        # Resolve who assigned this leave (if applicable)
        leave.assigned_by_name = _resolve_approver_name(db, leave.assigned_by)
        output.append(leave)

    return output
def get_leave_history(
    db: Session,
    user: dict,
    search: str | None = None,
    leave_type_id: int | None = None,
    status: str | None = None,
    sort_by: str = "newest",
    page: int = 1,
    page_size: int = 20,
):
    query = db.query(LeaveRequest, LeaveType.name.label("leave_type_name")).join(
        LeaveType, LeaveRequest.leave_type_id == LeaveType.id
    )

    if user["role"] == "employee":
        query = query.filter(LeaveRequest.employee_id == user["id"])
    elif user["role"] == "hr":
        pass  # HR sees all employees' leave history
    # NOTE: The "manager" role branch is not reachable in the current implementation.
    # leave_actor() in router.py only sets role to "hr" or "employee".
    # If a dedicated manager scope is added in future, implement team filtering here.
    # elif user["role"] == "manager":
    #     team = get_team_members(db, user["id"])
    #     query = query.filter(
    #         or_(
    #             LeaveRequest.employee_id == user["id"],
    #             LeaveRequest.employee_id.in_(team),
    #         )
    #     )

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

    total = query.count()
    offset = (page - 1) * page_size
    results = query.offset(offset).limit(page_size).all()

    output = []
    for leave, leave_type_name in results:
        leave.leave_type_name = leave_type_name
        leave.approved_by_name = _resolve_approver_name(db, leave.approved_by)
        if user["role"] == "hr" or user["role"] == "manager":
            _attach_employee_info(db, leave)
        output.append(leave)

    return output

def _resolve_approver_name(db: Session, approved_by: int | None) -> str | None:
    if approved_by is None:
        return None
    from app.employees.models import Employee
    emp = db.query(Employee).filter(Employee.id == approved_by).first()
    if emp:
        return f"{emp.first_name or ''} {emp.last_name or ''}".strip() or f"Employee {approved_by}"
    return f"Employee {approved_by}"

def _audit_leave(db: Session, leave_request_id: int, old_status: str | None,
                 new_status: str, changed_by: int | None = None, note: str | None = None):
    """Append an immutable audit entry for a leave status change."""
    try:
        entry = LeaveAuditLog(
            leave_request_id=leave_request_id,
            changed_by_employee_id=changed_by,
            old_status=old_status,
            new_status=new_status,
            note=note,
        )
        db.add(entry)
        # Caller is responsible for db.commit()
    except Exception as e:
        _notif_logger.error(f"[Leave] Audit log write failed: {e}")


def create_leave(db: Session, employee_id: int, data: LeaveRequestCreate, auto_approve: bool = False,
                 assigned_by: int | None = None):
    if data.start_date > data.end_date:
        raise ValueError("start_date cannot be after end_date")

    if not leave_type_exists(db, data.leave_type_id):
        raise ValueError("Invalid leave_type_id")

    leave_type = db.query(LeaveType).filter(LeaveType.id == data.leave_type_id).first()

    if has_overlapping_leave(db, employee_id, data.start_date, data.end_date):
        raise HTTPException(status_code=400, detail="You already have a leave request for these dates")

    total_days = calculate_total_days(db, data.start_date, data.end_date, data.half_day)

    _enforce_balance(db, employee_id, leave_type, total_days, data.start_date)

    # ── Determine initial status for assigned leaves ───────────────────────────
    # Medical leave assigned by HR stays PENDING so another HR/Admin can review it.
    # All other leave types (Annual, Casual, etc.) are immediately APPROVED when
    # HR assigns them on behalf of an employee.
    is_medical = leave_type is not None and "medical" in leave_type.name.lower()
    if assigned_by is not None:
        if is_medical:
            initial_status = "PENDING_MEDICAL"
        else:
            initial_status = "APPROVED"
            auto_approve = True  # used below to gate notifications
    else:
        initial_status = "APPROVED" if auto_approve else "PENDING"

    req = LeaveRequest(
        employee_id=employee_id,
        leave_type_id=data.leave_type_id,
        start_date=data.start_date,
        end_date=data.end_date,
        total_days=total_days,
        half_day=data.half_day,
        status=initial_status,
        reason=data.reason,
        attachment_urls=data.attachment_urls,
        assigned_by=assigned_by,
        # When auto-approving an assigned leave, record the assigner as approver
        approved_by=assigned_by if (assigned_by is not None and not is_medical) else None,
        approved_date=date.today() if (assigned_by is not None and not is_medical) else None,
    )

    try:
        db.add(req)
        db.flush()
        _audit_leave(db, req.leave_request_id, None, req.status, assigned_by)
        db.commit()
        db.refresh(req)

        # ── If HR assigned this leave, send notifications ──────────────────────
        if assigned_by is not None:
            try:
                from app.notifications.service import notify_permission, notify_employee, get_employee_name
                _emp_name = get_employee_name(db, employee_id)
                _lt = leave_type.name if leave_type else "leave"
                if is_medical:
                    # Medical: still pending, notify employee and other HR/Admin to review
                    notify_employee(
                        db, employee_id,
                        f"HR assigned a {_lt} leave for you — pending approval",
                        category="leave", type="info", link="/leave-history",
                        entity_type="leave_request", entity_id=str(req.leave_request_id),
                    )
                    notify_permission(
                        db, "leave:assign",
                        f"{_emp_name}'s {_lt} leave was assigned and needs approval",
                        category="leave", type="info", link="/approval",
                        entity_type="leave_request", entity_id=str(req.leave_request_id),
                        exclude_employee_id=assigned_by,
                    )
                else:
                    # Non-medical: auto-approved, just notify the employee
                    notify_employee(
                        db, employee_id,
                        f"HR assigned and approved a {_lt} leave for you",
                        category="leave", type="success", link="/leave-history",
                        entity_type="leave_request", entity_id=str(req.leave_request_id),
                    )
                db.commit()
            except Exception as e:
                _notif_logger.error(f"[Leave] Notification failed for assign: {e}")

        # ── Notify leave approvers for self-requested (non-assigned) leaves ────
        if assigned_by is None and not auto_approve:
            try:
                from app.notifications.service import notify_permission, get_employee_name
                emp_name = get_employee_name(db, employee_id)
                leave_type_name = leave_type.name if leave_type else "leave"
                notify_permission(
                    db, "leave:approve",
                    f"{emp_name} requested {leave_type_name} leave ({data.start_date} – {data.end_date})",
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
    _attach_employee_info(db, leave)
    return leave


def approve_leave_request(
    db: Session,
    request_id: int,
    approved_by: int,
    manager_comment: str | None = None,
    approved_leave_type_id: int | None = None,
):
    req = db.query(LeaveRequest).filter(LeaveRequest.leave_request_id == request_id).first()

    if not req:
        return None

    if req.status != "PENDING" and req.status != "PENDING_MEDICAL":
        raise ValueError("Only pending leave requests can be approved")

    # If approved_leave_type_id is provided and different, check requirements
    if approved_leave_type_id is not None and approved_leave_type_id != req.leave_type_id:
        new_lt = db.query(LeaveType).filter(LeaveType.id == approved_leave_type_id).first()
        if not new_lt:
            raise ValueError("Invalid approved leave type ID")
        
        # Enforce balance on the new type, excluding current request's old type/days
        _enforce_balance(db, req.employee_id, new_lt, req.total_days, req.start_date, exclude_request_id=req.leave_request_id)
        req.leave_type_id = approved_leave_type_id

    old_status = req.status
    req.status = "APPROVED"
    req.approved_by = approved_by
    req.approved_date = date.today()
    req.rejection_reason = None
    req.manager_comment = manager_comment

    _audit_leave(db, req.leave_request_id, old_status, "APPROVED", approved_by, manager_comment)
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
            f"Your leave request ({req.start_date} - {req.end_date}) was approved as {lt_name}",
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

    if req.status != "PENDING" and req.status != "PENDING_MEDICAL":
        raise ValueError("Only pending leave requests can be rejected")

    if not rejection_reason or not rejection_reason.strip():
        raise ValueError("rejection_reason is required")

    old_status = req.status
    req.status = "REJECTED"
    req.approved_by = approved_by
    req.approved_date = date.today()
    req.rejection_reason = rejection_reason.strip()
    req.manager_comment = None

    _audit_leave(db, req.leave_request_id, old_status, "REJECTED", approved_by, rejection_reason.strip())
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

    if req.status != "PENDING" and req.status != "PENDING_MEDICAL":
        raise ValueError("Only pending leave requests can be marked as request info")

    if not manager_comment or not manager_comment.strip():
        raise ValueError("manager_comment is required")

    old_status = req.status
    req.status = "REQ_INFO"
    req.approved_by = approved_by
    req.manager_comment = manager_comment.strip()

    _audit_leave(db, req.leave_request_id, old_status, "REQ_INFO", approved_by, manager_comment.strip())
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
    start_date: date | None = None,
    end_date: date | None = None,
    half_day: bool | None = None,
):
    req = db.query(LeaveRequest).filter(
        LeaveRequest.leave_request_id == request_id,
        LeaveRequest.employee_id == employee_id
    ).first()

    if not req:
        raise ValueError("Leave request not found or not authorized")

    if req.status != "REQ_INFO" and req.status != "PENDING_MEDICAL":
        raise ValueError("Only requests needing info or pending medical can be resubmitted")

    # Append new attachments to existing ones
    if attachment_urls:
        existing_urls = req.attachment_urls if isinstance(req.attachment_urls, list) else []
        req.attachment_urls = existing_urls + attachment_urls

    if reason is not None and reason.strip():
        req.reason = reason.strip()

    # Allow employee to correct dates on resubmission
    if start_date is not None or end_date is not None:
        new_start = start_date or req.start_date
        new_end = end_date or req.end_date
        new_half_day = half_day if half_day is not None else req.half_day

        if new_start > new_end:
            raise ValueError("start_date cannot be after end_date")

        # Check overlap excluding self
        overlap = (
            db.query(LeaveRequest)
            .filter(
                LeaveRequest.employee_id == req.employee_id,
                LeaveRequest.leave_request_id != req.leave_request_id,
                LeaveRequest.start_date <= new_end,
                LeaveRequest.end_date >= new_start,
                LeaveRequest.status.in_(["PENDING", "APPROVED", "REQ_INFO", "PENDING_MEDICAL"]),
            )
            .first()
        )
        if overlap:
            raise ValueError("You already have an overlapping leave request for these dates")

        leave_type = db.query(LeaveType).filter(LeaveType.id == req.leave_type_id).first()
        new_total = calculate_total_days(db, new_start, new_end, new_half_day)
        _enforce_balance(db, req.employee_id, leave_type, new_total, new_start,
                         exclude_request_id=req.leave_request_id)

        req.start_date = new_start
        req.end_date = new_end
        req.half_day = new_half_day
        req.total_days = new_total

    old_status = req.status
    req.status = "PENDING"
    req.manager_comment = None  # Clear HR comment since they are replying

    _audit_leave(db, req.leave_request_id, old_status, "PENDING", employee_id, reason)
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


def request_medical_leave(
    db: Session,
    request_id: int,
    reviewed_by: int,
    manager_comment: str | None = None,
):
    """
    HR marks a leave request as PENDING_MEDICAL — indicating that they want the
    employee to provide medical documentation before the leave can be approved.
    The request remains visible in the HR approval panel (highlighted) and the
    employee is notified to upload their medical certificate.
    """
    req = db.query(LeaveRequest).filter(LeaveRequest.leave_request_id == request_id).first()

    if not req:
        return None

    if req.status not in ("PENDING", "PENDING_MEDICAL"):
        raise ValueError("Only PENDING leave requests can be flagged for medical documentation")

    # Set leave type to Medical
    medical_lt = db.query(LeaveType).filter(LeaveType.name.ilike("%medical%")).first()
    if not medical_lt:
        raise ValueError("Medical leave type not found in the database")

    req.leave_type_id = medical_lt.id
    old_status = req.status
    req.status = "PENDING_MEDICAL"
    req.approved_by = reviewed_by
    req.manager_comment = manager_comment.strip() if manager_comment and manager_comment.strip() else None

    _audit_leave(db, req.leave_request_id, old_status, "PENDING_MEDICAL", reviewed_by, manager_comment.strip() if manager_comment else None)
    db.commit()
    db.refresh(req)

    # ── Notify requesting employee ────────────────────────────────────
    try:
        from app.notifications.service import notify_employee
        msg = (
            f"HR has requested medical documentation for your Medical Leave request "
            f"({req.start_date} \u2013 {req.end_date}). "
            f"Please upload your medical certificate to proceed."
        )
        if manager_comment and manager_comment.strip():
            msg += f" Note: {manager_comment.strip()}"
        notify_employee(
            db, req.employee_id,
            msg,
            category="leave", type="warning", link="/leave-history",
            entity_type="leave_request", entity_id=str(req.leave_request_id),
        )
        db.commit()
    except Exception as e:
        _notif_logger.error(f"[Leave] Notification failed for request_medical: {e}")

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

    old_status = req.status
    req.status = status

    if status == "APPROVED":
        req.approved_by = approved_by
        req.approved_date = date.today()
        req.rejection_reason = None

    elif status == "REJECTED":
        req.approved_by = approved_by
        req.approved_date = date.today()
        req.rejection_reason = rejection_reason

    _audit_leave(db, req.leave_request_id, old_status, status, approved_by, rejection_reason if status == "REJECTED" else None)
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
    _audit_leave(db, req.leave_request_id, req.status, "DELETED", employee_id,
                 "Leave request deleted by employee")
    db.delete(req)
    db.commit()
    return True


def cancel_approved_leave(db: Session, request_id: int, employee_id: int, reason: str | None = None):
    """Allow an employee to cancel an APPROVED leave that hasn't started yet."""
    req = db.query(LeaveRequest).filter(
        LeaveRequest.leave_request_id == request_id,
        LeaveRequest.employee_id == employee_id,
    ).first()
    if not req:
        raise ValueError("Leave request not found or not authorized")
    if req.status != "APPROVED":
        raise ValueError("Only APPROVED leave requests can be cancelled this way")
    if req.start_date <= date.today():
        raise ValueError("Cannot cancel a leave that has already started")

    old_status = req.status
    req.status = "CANCELLED"
    req.manager_comment = reason
    _audit_leave(db, req.leave_request_id, old_status, "CANCELLED", employee_id, reason)
    db.commit()
    db.refresh(req)
    req.approved_by_name = _resolve_approver_name(db, req.approved_by)
    return req


def get_leave_audit_log(db: Session, request_id: int):
    """Return all audit log entries for a specific leave request."""
    return (
        db.query(LeaveAuditLog)
        .filter(LeaveAuditLog.leave_request_id == request_id)
        .order_by(LeaveAuditLog.changed_at.asc())
        .all()
    )


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
            LeaveRequest.status.in_(["PENDING", "APPROVED", "REQ_INFO", "PENDING_MEDICAL"])
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


def get_leave_types(db: Session, requestable_only: bool = False):
    query = db.query(LeaveType)
    if requestable_only:
        query = query.filter(LeaveType.directly_requestable == True)
    return query.order_by(LeaveType.id.asc()).all()


def create_leave_type(db: Session, name: str, description: str | None = None, directly_requestable: bool = True):
    existing = db.query(LeaveType).filter(LeaveType.name == name).first()
    if existing:
        raise ValueError("Leave type already exists")

    leave_type = LeaveType(name=name, description=description, directly_requestable=directly_requestable)
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


def create_medical_conversion(db: Session, employee_id: int, request_id: int, data):
    from app.leave.models import LeaveMedicalConversion, LeaveRequest, LeaveType
    from datetime import date as dt_date
    req = db.query(LeaveRequest).filter(LeaveRequest.leave_request_id == request_id).first()
    if not req:
        raise ValueError("Leave request not found")
    if req.employee_id != employee_id:
        raise ValueError("Not authorized to request conversion for this leave")
    if req.status != "APPROVED":
        raise ValueError("Only approved leave requests can be converted")

    lt = db.query(LeaveType).filter(LeaveType.id == req.leave_type_id).first()
    if not lt or "casual" not in lt.name.lower():
        raise ValueError("Only casual leave requests can be reclassified to medical")

    if data.start_date < req.start_date or data.end_date > req.end_date:
        raise ValueError("Reclassification sub-range must fall within the original leave dates")
    if data.start_date > data.end_date:
        raise ValueError("start_date cannot be after end_date")

    # Attachment is optional at request time — HR can require it via PENDING_MEDICAL flow.

    existing_overlap = (
        db.query(LeaveMedicalConversion)
        .filter(
            LeaveMedicalConversion.leave_request_id == request_id,
            LeaveMedicalConversion.status.in_(["PENDING", "APPROVED"]),
            LeaveMedicalConversion.start_date <= data.end_date,
            LeaveMedicalConversion.end_date >= data.start_date,
        )
        .first()
    )
    if existing_overlap:
        raise ValueError("An overlapping reclassification request is already pending or approved for these dates")

    total_days_to_convert = calculate_total_days(db, data.start_date, data.end_date, half_day=False)
    if total_days_to_convert <= 0:
        raise ValueError("The selected date range does not contain any working days to convert")

    conversion = LeaveMedicalConversion(
        leave_request_id=request_id,
        employee_id=employee_id,
        start_date=data.start_date,
        end_date=data.end_date,
        attachment_urls=data.attachment_urls,
        reason=data.reason,
        status="PENDING",
    )
    db.add(conversion)
    db.commit()
    db.refresh(conversion)

    try:
        from app.notifications.service import notify_permission, get_employee_name
        emp_name = get_employee_name(db, employee_id)
        notify_permission(
            db, "leave:approve",
            f"{emp_name} requested Medical Reclassification for casual leave ({data.start_date} – {data.end_date})",
            category="leave", type="info", link="/approval",
            entity_type="medical_conversion", entity_id=str(conversion.id),
            exclude_employee_id=employee_id,
        )
        db.commit()
    except Exception as e:
        _notif_logger.error(f"[Leave] Notification failed for medical conversion: {e}")

    return conversion


def list_medical_conversions(db: Session, request_id: int):
    from app.leave.models import LeaveMedicalConversion
    return db.query(LeaveMedicalConversion).filter(LeaveMedicalConversion.leave_request_id == request_id).all()


def get_pending_medical_conversions(db: Session, user: dict):
    from app.leave.models import LeaveMedicalConversion
    from app.employees.models import Employee
    role = user.get("role", "").lower()
    if role != "hr":
        return []
    # A reclassification is reviewed by the SAME approver who approved the
    # original leave — so only surface conversions whose original leave was
    # approved by this reviewer.
    convs = (
        db.query(LeaveMedicalConversion)
        .join(LeaveRequest, LeaveMedicalConversion.leave_request_id == LeaveRequest.leave_request_id)
        .filter(
            LeaveMedicalConversion.status == "PENDING",
            LeaveMedicalConversion.employee_id != user["id"],
            LeaveRequest.approved_by == user["id"],
        )
        .order_by(LeaveMedicalConversion.id.desc())
        .all()
    )
    # Attach the requesting employee's name so approvers see who it's for.
    for conv in convs:
        emp = db.query(Employee).filter(Employee.id == conv.employee_id).first()
        if emp:
            conv.employee_name = f"{emp.first_name or ''} {emp.last_name or ''}".strip() or f"Employee {conv.employee_id}"
        else:
            conv.employee_name = f"Employee {conv.employee_id}"
    return convs


def approve_medical_conversion(db: Session, conversion_id: int, reviewer_id: int, comment: str | None = None):
    from app.leave.models import LeaveMedicalConversion, LeaveRequest, LeaveType
    from datetime import timedelta, date as dt_date
    conv = db.query(LeaveMedicalConversion).filter(LeaveMedicalConversion.id == conversion_id).first()
    if not conv:
        raise ValueError("Conversion request not found")
    if conv.status != "PENDING":
        raise ValueError("Conversion request is already processed")
    # Separation of duties: a reviewer cannot approve their own reclassification.
    if conv.employee_id == reviewer_id:
        raise ValueError("You cannot review your own reclassification request")

    original = db.query(LeaveRequest).filter(LeaveRequest.leave_request_id == conv.leave_request_id).first()
    if not original:
        raise ValueError("Original leave request not found")
    if original.status != "APPROVED":
        raise ValueError("Original leave request is no longer approved")
    # Only the manager who approved the original leave may review its reclassification.
    if original.approved_by != reviewer_id:
        raise ValueError("Only the approver of the original leave can review this reclassification")

    medical_lt = db.query(LeaveType).filter(LeaveType.name.ilike("%medical%")).first()
    if not medical_lt:
        raise ValueError("Medical leave type not found in the database")

    total_days_to_convert = calculate_total_days(db, conv.start_date, conv.end_date, half_day=False)
    if total_days_to_convert <= 0:
        raise ValueError("No working days to convert")

    _enforce_balance(db, original.employee_id, medical_lt, total_days_to_convert, conv.start_date)

    has_prefix = conv.start_date > original.start_date
    has_suffix = conv.end_date < original.end_date

    if not has_prefix and not has_suffix:
        # Complete conversion
        original.leave_type_id = medical_lt.id
        if original.attachment_urls:
            original.attachment_urls = list(set(original.attachment_urls + (conv.attachment_urls or [])))
        else:
            original.attachment_urls = conv.attachment_urls
        original.total_days = total_days_to_convert
        original.reason = (original.reason or "") + f" (Reclassified: {conv.reason or ''})"
    else:
        orig_employee_id = original.employee_id
        orig_leave_type_id = original.leave_type_id
        orig_reason = original.reason
        orig_attachment_urls = original.attachment_urls
        orig_half_day = original.half_day

        if has_prefix and not has_suffix:
            original.end_date = conv.start_date - timedelta(days=1)
            original.total_days = calculate_total_days(db, original.start_date, original.end_date, original.half_day)
            
            medical_req = LeaveRequest(
                employee_id=orig_employee_id,
                leave_type_id=medical_lt.id,
                approved_by=reviewer_id,
                start_date=conv.start_date,
                end_date=conv.end_date,
                total_days=total_days_to_convert,
                half_day=False,
                status="APPROVED",
                reason=f"Reclassified from Casual request #{original.leave_request_id}. Reason: {conv.reason or ''}",
                attachment_urls=conv.attachment_urls,
                parent_request_id=original.leave_request_id,
                approved_date=date.today(),
            )
            db.add(medical_req)
        elif not has_prefix and has_suffix:
            original.start_date = conv.end_date + timedelta(days=1)
            original.total_days = calculate_total_days(db, original.start_date, original.end_date, original.half_day)
            
            medical_req = LeaveRequest(
                employee_id=orig_employee_id,
                leave_type_id=medical_lt.id,
                approved_by=reviewer_id,
                start_date=conv.start_date,
                end_date=conv.end_date,
                total_days=total_days_to_convert,
                half_day=False,
                status="APPROVED",
                reason=f"Reclassified from Casual request #{original.leave_request_id}. Reason: {conv.reason or ''}",
                attachment_urls=conv.attachment_urls,
                parent_request_id=original.leave_request_id,
                approved_date=date.today(),
            )
            db.add(medical_req)
        else:
            suffix_start = conv.end_date + timedelta(days=1)
            suffix_end = original.end_date
            
            original.end_date = conv.start_date - timedelta(days=1)
            original.total_days = calculate_total_days(db, original.start_date, original.end_date, original.half_day)
            
            suffix_days = calculate_total_days(db, suffix_start, suffix_end, original.half_day)
            suffix_req = LeaveRequest(
                employee_id=orig_employee_id,
                leave_type_id=orig_leave_type_id,
                approved_by=original.approved_by,
                start_date=suffix_start,
                end_date=suffix_end,
                total_days=suffix_days,
                half_day=original.half_day,
                status="APPROVED",
                reason=original.reason,
                attachment_urls=orig_attachment_urls,
                parent_request_id=original.leave_request_id,
                approved_date=original.approved_date,
            )
            db.add(suffix_req)
            
            medical_req = LeaveRequest(
                employee_id=orig_employee_id,
                leave_type_id=medical_lt.id,
                approved_by=reviewer_id,
                start_date=conv.start_date,
                end_date=conv.end_date,
                total_days=total_days_to_convert,
                half_day=False,
                status="APPROVED",
                reason=f"Reclassified from Casual request #{original.leave_request_id}. Reason: {conv.reason or ''}",
                attachment_urls=conv.attachment_urls,
                parent_request_id=original.leave_request_id,
                approved_date=date.today(),
            )
            db.add(medical_req)

    conv.status = "APPROVED"
    conv.reviewer_id = reviewer_id
    conv.reviewer_comment = comment
    
    db.commit()
    db.refresh(conv)

    try:
        from app.notifications.service import notify_employee
        notify_employee(
            db, original.employee_id,
            f"Your reclassification request to Medical for dates ({conv.start_date} - {conv.end_date}) was approved",
            category="leave", type="success", link="/leave-history",
            entity_type="medical_conversion", entity_id=str(conv.id),
        )
        db.commit()
    except Exception as e:
        _notif_logger.error(f"[Leave] Notification failed for approve conversion: {e}")

    return conv


def reject_medical_conversion(db: Session, conversion_id: int, reviewer_id: int, comment: str | None = None):
    from app.leave.models import LeaveMedicalConversion, LeaveRequest
    conv = db.query(LeaveMedicalConversion).filter(LeaveMedicalConversion.id == conversion_id).first()
    if not conv:
        raise ValueError("Conversion request not found")
    if conv.status != "PENDING":
        raise ValueError("Conversion request is already processed")
    # Separation of duties: a reviewer cannot reject their own reclassification.
    if conv.employee_id == reviewer_id:
        raise ValueError("You cannot review your own reclassification request")
    # Only the manager who approved the original leave may review its reclassification.
    original = db.query(LeaveRequest).filter(LeaveRequest.leave_request_id == conv.leave_request_id).first()
    if original and original.approved_by != reviewer_id:
        raise ValueError("Only the approver of the original leave can review this reclassification")

    conv.status = "REJECTED"
    conv.reviewer_id = reviewer_id
    conv.reviewer_comment = comment
    
    db.commit()
    db.refresh(conv)

    try:
        from app.notifications.service import notify_employee
        notify_employee(
            db, conv.employee_id,
            f"Your reclassification request to Medical for dates ({conv.start_date} - {conv.end_date}) was rejected: {comment or ''}",
            category="leave", type="error", link="/leave-history",
            entity_type="medical_conversion", entity_id=str(conv.id),
        )
        db.commit()
    except Exception as e:
        _notif_logger.error(f"[Leave] Notification failed for reject conversion: {e}")

    return conv