"""
documents/services/request_service.py
======================================
Service layer for managing internal document requests (submitted via portal).

Responsibilities:
- Creating new document requests.
- Retrieving requests for HR or for specific employees.
"""

from fastapi import HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
import logging

from app.documents.models.request_model import DocumentRequest, RequestStatus
from app.documents.schemas.request_schema import CreateRequest
from app.employees.models import Employee

_notif_logger = logging.getLogger(__name__)


def create_document_request(db: Session, data: CreateRequest) -> DocumentRequest:
    """Create a new INTERNAL document request from the portal.

    Args:
        db: Active database session.
        data: Validated CreateRequest input payload.

    Returns:
        The created DocumentRequest ORM object.

    Raises:
        HTTPException 404: If the requesting employee doesn't exist.
        HTTPException 500: If the database commit fails.
    """
    employee = db.query(Employee).filter(Employee.id == data.employee_id).first()
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    new_request = DocumentRequest(
        employee_id=data.employee_id,
        document_type=data.document_type,
        reason=data.reason,
        status=RequestStatus.PENDING,
        source="INTERNAL",
    )

    try:
        db.add(new_request)
        db.commit()
        db.refresh(new_request)

        # ── Notify the eligible managers (separation-of-duties routing) ───
        try:
            from app.notifications.service import notify_users
            from app.documents.services.approval_routing import (
                get_eligible_handler_user_ids, employee_user_id,
            )
            requester_uid = employee_user_id(db, data.employee_id)
            recipients = get_eligible_handler_user_ids(db, requester_uid, "document:request_manage")
            notify_users(
                db, recipients,
                f"{employee.first_name} {employee.last_name} requested a {data.document_type} document",
                category="document", type="info", link="/dashboard/documents/request_management",
                entity_type="document_request", entity_id=str(new_request.id),
            )
            db.commit()
        except Exception as e:
            _notif_logger.error(f"[Documents] Notification failed for new request: {e}")

        return new_request
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit document request."
        ) from exc


def get_all_requests(db: Session) -> list[DocumentRequest]:
    """Retrieve all document requests across the system.

    (Note: Typically used by system admin / overview; HR uses hr_request_service).

    Args:
        db: Active database session.

    Returns:
        List of DocumentRequest ORM objects ordered by creation date descending.
    """
    return db.query(DocumentRequest).order_by(DocumentRequest.created_at.desc()).all()


def get_employee_requests(db: Session, employee_id: int) -> list[dict]:
    """Retrieve all document requests for a specific employee.

    Injects the employee name into the response dictionary for the frontend.

    Args:
        db: Active database session.
        employee_id: Integer ID of the employee.

    Returns:
        List of dictionaries representing the employee's requests.
    """
    requests = (
        db.query(DocumentRequest, Employee)
        .join(Employee, Employee.id == DocumentRequest.employee_id)
        .filter(DocumentRequest.employee_id == employee_id)
        .order_by(DocumentRequest.created_at.desc())
        .all()
    )

    result = []
    for req, emp in requests:
        result.append({
            "id": req.id,
            "employee_id": req.employee_id,
            "employee_name": f"{emp.first_name} {emp.last_name}",
            "document_type": req.document_type,
            "reason": req.reason,
            "status": req.status,
            "source": getattr(req, "source", "INTERNAL"),
            "requester_email": getattr(req, "requester_email", None),
            "rejection_reason": req.rejection_reason,
            "generated_document_path": req.generated_document_path,
            "created_at": req.created_at
        })

    return result