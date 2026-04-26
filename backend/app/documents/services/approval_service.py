"""
documents/services/approval_service.py
======================================
Service layer for HR document approval workflows.

Responsibilities:
- Retrieving pending documents.
- Approving or rejecting employee documents.
- Logging status transitions to the audit log.
- Sending notification emails to employees on rejection.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.documents.models.model import EmployeeDocument, DocumentStatus
from app.documents.models.audit_log_model import DocumentAuditLog
from app.employees.models import Employee
from app.core.config import get_settings


def _write_audit_log(
    db: Session,
    request_id: UUID,
    changed_by_employee_id: int,
    old_status: str,
    new_status: str,
    note: str = None
) -> None:
    """Helper to write a record to the DocumentAuditLog.

    Note: This does not commit the database session; the caller is responsible
    for committing so the log is saved atomically with the status change.
    """
    audit = DocumentAuditLog(
        request_id=request_id,
        changed_by_employee_id=changed_by_employee_id,
        old_status=old_status,
        new_status=new_status,
        note=note,
    )
    db.add(audit)


def get_pending_documents(db: Session) -> list[dict]:
    """Retrieve all documents currently awaiting HR review.

    Args:
        db: Active database session.

    Returns:
        List of dictionaries containing document data and employee names.
    """
    documents = (
        db.query(EmployeeDocument, Employee)
        .join(Employee, Employee.id == EmployeeDocument.employee_id)
        .filter(EmployeeDocument.status == DocumentStatus.PENDING_REVIEW)
        .order_by(EmployeeDocument.uploaded_at.desc())
        .all()
    )
    
    result = []
    for doc, emp in documents:
        result.append({
            "id": doc.id,
            "employee_id": doc.employee_id,
            "employee_name": f"{emp.first_name} {emp.last_name}",
            "document_type": doc.document_type,
            "file_name": doc.file_name,
            "file_path": doc.file_path,
            "status": doc.status,
            "uploaded_at": doc.uploaded_at
        })
    return result


def approve_document(db: Session, document_id: UUID, reviewer_id: int) -> EmployeeDocument:
    """Approve a pending employee document.

    Args:
        db: Active database session.
        document_id: UUID of the document to approve.
        reviewer_id: Employee ID of the HR user approving the document.

    Returns:
        The updated EmployeeDocument ORM object.

    Raises:
        HTTPException 404: If document is not found.
        HTTPException 400: If document is already approved/rejected.
        HTTPException 500: If the database commit fails.
    """
    document = db.query(EmployeeDocument).filter(EmployeeDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if document.status != DocumentStatus.PENDING_REVIEW:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document cannot be approved from current status: {document.status.value}"
        )

    old_status_val = document.status.value
    document.status = DocumentStatus.APPROVED
    document.reviewed_by = reviewer_id

    _write_audit_log(
        db=db,
        request_id=document.id,
        changed_by_employee_id=reviewer_id,
        old_status=old_status_val,
        new_status=DocumentStatus.APPROVED.value,
        note="Approved by HR",
    )

    try:
        db.commit()
        db.refresh(document)
        return document
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to approve document."
        ) from exc


def reject_document(db: Session, document_id: UUID, reviewer_id: int, reason: str) -> EmployeeDocument:
    """Reject a pending employee document and notify the employee.

    Args:
        db: Active database session.
        document_id: UUID of the document to reject.
        reviewer_id: Employee ID of the HR user rejecting the document.
        reason: Text explaining why the document was rejected.

    Returns:
        The updated EmployeeDocument ORM object.

    Raises:
        HTTPException 404: If document is not found.
        HTTPException 400: If document is already approved/rejected.
        HTTPException 500: If the database commit fails.
    """
    document = db.query(EmployeeDocument).filter(EmployeeDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if document.status != DocumentStatus.PENDING_REVIEW:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document cannot be rejected from current status: {document.status.value}"
        )

    old_status_val = document.status.value
    document.status = DocumentStatus.REJECTED
    document.reviewed_by = reviewer_id
    document.rejection_reason = reason

    _write_audit_log(
        db=db,
        request_id=document.id,
        changed_by_employee_id=reviewer_id,
        old_status=old_status_val,
        new_status=DocumentStatus.REJECTED.value,
        note=reason,
    )

    try:
        db.commit()
        db.refresh(document)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reject document."
        ) from exc

    # Attempt to send rejection email, but don't fail the request if email fails
    employee = db.query(Employee).filter(Employee.id == document.employee_id).first()
    if employee and employee.email:
        try:
            _send_rejection_email(
                to_email=employee.email,
                document_type=document.document_type,
                reason=reason
            )
        except Exception as e:
            print(f"[Approval Service] Failed to send rejection email: {e}")

    return document


def _send_rejection_email(to_email: str, document_type: str, reason: str) -> None:
    """Send an email notification when a document is rejected.

    Args:
        to_email: Employee's email address.
        document_type: The type of document rejected.
        reason: The rejection reason provided by HR.
    """
    settings = get_settings()
    if not settings.imap_user or not settings.imap_password:
        print("[Approval Service] SMTP credentials missing, skipping rejection email.")
        return

    import smtplib
    from email.mime.text import MIMEText

    msg = MIMEText(
        f"Hello,\n\nYour uploaded document '{document_type}' has been reviewed and rejected.\n\n"
        f"Reason: {reason}\n\nPlease upload a corrected version via the portal.\n\nRegards,\nHR Department"
    )
    msg['Subject'] = f"Document Rejected: {document_type}"
    msg['From'] = settings.imap_user
    msg['To'] = to_email

    server = smtplib.SMTP(settings.smtp_server, settings.smtp_port)
    server.starttls()
    server.login(settings.imap_user, settings.imap_password)
    server.send_message(msg)
    server.quit()