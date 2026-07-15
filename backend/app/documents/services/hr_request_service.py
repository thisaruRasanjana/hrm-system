"""
documents/services/hr_request_service.py
=========================================
Service layer for HR document request management.

Responsibilities:
- Fetching and filtering all HR document requests with employee join.
- Updating request statuses (approve / reject / in-progress).
- Assigning an internal employee to an external request.

WHY a service layer: Keeps business logic out of the router so it can be
tested independently and reused by multiple endpoints if needed.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
import logging

from app.documents.models.request_model import DocumentRequest, RequestStatus
from app.employees.models import Employee
from app.core.storage_service import storage

_notif_logger = logging.getLogger(__name__)


def ensure_can_handle_request(db: Session, request: DocumentRequest, current_user_id: int) -> None:
    """Raise 403 if current_user is not allowed to act on this request
    (separation of duties — no self/peer handling; HR requests escalate to a super admin)."""
    from app.documents.services.approval_routing import can_user_handle, employee_user_id
    requester_uid = employee_user_id(db, request.employee_id)  # None for external requests
    if not can_user_handle(db, current_user_id, requester_uid, "document:request_manage"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to handle this request. It must be handled by a higher authority.",
        )


def get_all_hr_requests(db: Session, current_user_id: int, filter_status: str = None) -> list[dict]:
    """Retrieve the document requests that ``current_user_id`` may handle.

    Applies separation-of-duties routing: a manager only sees requests they are
    allowed to act on — never their own, never a peer's (those escalate to a
    super admin); employees' and external requests go to HR. Performs an
    outer-join with Employee so external requests (no linked employee) are kept.

    Args:
        db: Active SQLAlchemy database session.
        current_user_id: The user id of the manager requesting the list.
        filter_status: Optional status string matching a RequestStatus enum key.

    Returns:
        List of request dictionaries including employee display name.
    """
    from app.documents.services.approval_routing import (
        get_super_admin_user_ids, eligible_handlers_from_sets,
    )
    from app.notifications.service import get_user_ids_with_permission

    query = (
        db.query(DocumentRequest, Employee)
        .outerjoin(Employee, Employee.id == DocumentRequest.employee_id)
        .order_by(DocumentRequest.created_at.desc())
    )

    if filter_status:
        try:
            status_enum = RequestStatus[filter_status]
            query = query.filter(DocumentRequest.status == status_enum)
        except KeyError:
            # Unknown status string — return unfiltered rather than crashing
            pass

    requests = query.all()

    # Resolve manager/super-admin sets once, then filter each request.
    manager_ids = set(get_user_ids_with_permission(db, "document:request_manage"))
    super_admin_ids = get_super_admin_user_ids(db)

    result = []
    for req, emp in requests:
        # External requests have no linked user → treated as employee-tier (→ HR).
        requester_uid = emp.user_id if emp else None
        eligible = eligible_handlers_from_sets(requester_uid, manager_ids, super_admin_ids)
        if current_user_id not in eligible:
            continue
        employee_name = f"{emp.first_name} {emp.last_name}" if emp else "External / Unknown"
        result.append({
            "id": req.id,
            "employee_id": req.employee_id,
            "employee_name": employee_name,
            "document_type": req.document_type,
            "reason": req.reason,
            "status": req.status,
            "source": getattr(req, "source", "INTERNAL"),
            "requester_email": getattr(req, "requester_email", None),
            "requester_message": getattr(req, "requester_message", None),
            "rejection_reason": req.rejection_reason,
            # Return a ready-to-use URL (local: /uploads/..., S3: presigned URL)
            # rather than the raw storage key, so the frontend can fetch it directly.
            "generated_document_path": storage.get_url(req.generated_document_path) if req.generated_document_path else None,
            "created_at": req.created_at,
        })

    return result


def update_request_status(
    db: Session,
    request_id: UUID,
    new_status: RequestStatus,
    rejection_reason: str = None,
    current_user_id: int = None,
) -> DocumentRequest:
    """Update the status of a document request.

    Args:
        db: Active SQLAlchemy database session.
        request_id: UUID of the DocumentRequest to update.
        new_status: The target RequestStatus enum value.
        rejection_reason: Required when new_status is REJECTED.

    Returns:
        The updated DocumentRequest ORM object.

    Raises:
        HTTPException 404: If the request is not found.
        HTTPException 400: If rejecting without providing a reason.
        HTTPException 500: If the database commit fails.
    """
    request = db.query(DocumentRequest).filter(DocumentRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    if current_user_id is not None:
        ensure_can_handle_request(db, request, current_user_id)

    if new_status == RequestStatus.REJECTED and not rejection_reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A rejection reason is required when rejecting a request.",
        )

    request.status = new_status
    if new_status == RequestStatus.REJECTED:
        request.rejection_reason = rejection_reason

    try:
        db.commit()
        db.refresh(request)

        # ── Notify requesting employee (if internal) ──────────────────────
        if request.employee_id:
            try:
                from app.notifications.service import notify_employee
                msg = f"Your document request ({request.document_type}) status changed to {new_status.value}"
                if new_status == RequestStatus.REJECTED:
                    msg = f"Your document request ({request.document_type}) was rejected: {rejection_reason}"
                notif_type = "error" if new_status == RequestStatus.REJECTED else "info"
                
                notify_employee(
                    db, request.employee_id, msg,
                    category="document", type=notif_type, link="/dashboard/documents/request",
                    entity_type="document_request", entity_id=str(request.id),
                )
                db.commit()
            except Exception as e:
                _notif_logger.error(f"[Documents] Notification failed for HR status update: {e}")

    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update request status. Please try again.",
        ) from exc

    return request


def assign_employee_to_request(
    db: Session,
    request_id: UUID,
    employee_id: int,
) -> dict:
    """Link an internal employee to an (initially external) document request.

    This is used when HR identifies which employee an external email request
    belongs to, before generating the document.

    Args:
        db: Active SQLAlchemy database session.
        request_id: UUID of the DocumentRequest to update.
        employee_id: Integer primary key of the Employee to link.

    Returns:
        Dict with a confirmation message and the employee's display name.

    Raises:
        HTTPException 404: If request or employee is not found.
        HTTPException 500: If the database commit fails.
    """
    request = db.query(DocumentRequest).filter(DocumentRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    request.employee_id = employee_id

    try:
        db.commit()
        db.refresh(request)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to assign employee to request.",
        ) from exc

    employee_name = f"{employee.first_name} {employee.last_name}"
    return {
        "message": f"Assigned {employee_name} to this request.",
        "employee_name": employee_name,
    }
