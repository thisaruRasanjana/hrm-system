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

from app.documents.models.request_model import DocumentRequest, RequestStatus
from app.employees.models import Employee


def get_all_hr_requests(db: Session, filter_status: str = None) -> list[dict]:
    """Retrieve all document requests, optionally filtered by status.

    Performs an outer-join with the Employee table so that external requests
    (which have no linked employee) are still returned.

    Args:
        db: Active SQLAlchemy database session.
        filter_status: Optional status string matching a RequestStatus enum key.

    Returns:
        List of request dictionaries including employee display name.
    """
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

    result = []
    for req, emp in requests:
        employee_name = f"{emp.first_name} {emp.last_name}" if emp else "External / Unknown"
        result.append({
            "id": req.id,
            "employee_id": req.employee_id,
            "employee_name": employee_name,
            "document_type": req.document_type,
            # 'purpose' key kept for frontend compatibility; value comes from 'reason'
            "purpose": req.reason,
            "status": req.status,
            "source": getattr(req, "source", "INTERNAL"),
            "requester_email": getattr(req, "requester_email", None),
            "rejection_reason": req.rejection_reason,
            "generated_document_path": req.generated_document_path,
            "created_at": req.created_at,
        })

    return result


def update_request_status(
    db: Session,
    request_id: UUID,
    new_status: RequestStatus,
    rejection_reason: str = None,
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
