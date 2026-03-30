from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import date
from sqlalchemy import or_, cast, String

from app.leave.models import LeaveRequest, LeaveType
from app.leave.schemas import LeaveRequestCreate


def calculate_total_days(start_date: date, end_date: date, half_day: bool) -> float:
    days = (end_date - start_date).days + 1

    if days < 1:
        raise ValueError("Invalid date range")

    if half_day:
        if start_date != end_date:
            raise ValueError("Half day leave must be for a single day only")
        return 0.5

    return float(days)


def leave_type_exists(db: Session, leave_type_id: int) -> bool:
    leave_type = db.query(LeaveType).filter(LeaveType.id == leave_type_id).first()
    return leave_type is not None


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


def create_leave(db: Session, employee_id: int, data: LeaveRequestCreate):
    if data.start_date > data.end_date:
        raise ValueError("start_date cannot be after end_date")

    if not leave_type_exists(db, data.leave_type_id):
        raise ValueError("Invalid leave_type_id")

    leave_type = db.query(LeaveType).filter(LeaveType.id == data.leave_type_id).first()

    if leave_type and "medical" in leave_type.name.lower() and not data.attachment_urls:
        raise ValueError("Medical leave requires at least one supporting document")

    if has_overlapping_leave(db, employee_id, data.start_date, data.end_date):
        raise ValueError("You already have a leave request for these dates")

    total_days = calculate_total_days(data.start_date, data.end_date, data.half_day)

    req = LeaveRequest(
        employee_id=employee_id,
        leave_type_id=data.leave_type_id,
        start_date=data.start_date,
        end_date=data.end_date,
        total_days=total_days,
        half_day=data.half_day,
        status="PENDING",
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
    return (
        db.query(LeaveRequest)
        .filter(LeaveRequest.leave_request_id == request_id)
        .first()
    )


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