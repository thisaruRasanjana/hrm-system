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

from datetime import datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.documents.models.model import EmployeeDocument, DocumentStatus
from app.documents.models.audit_log_model import DocumentAuditLog
from app.employees.models import Employee
from app.core.config import get_settings
from app.core.storage_service import storage


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


def _ensure_can_review(db: Session, uploader_employee_id: int, current_user_id: int) -> None:
    """Raise 403 if current_user is not allowed to review this employee's upload
    (separation of duties — no self/peer approval; HR documents escalate to a super admin)."""
    from app.documents.services.approval_routing import can_user_handle, employee_user_id
    uploader_uid = employee_user_id(db, uploader_employee_id)
    if not can_user_handle(db, current_user_id, uploader_uid, "document:approve"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to review this document. It must be handled by a higher authority.",
        )


def get_pending_documents(db: Session, current_user_id: int) -> list[dict]:
    """Retrieve documents awaiting review that ``current_user_id`` may handle.

    Applies separation-of-duties routing: a reviewer only sees uploads they are
    allowed to approve — never their own, never a peer's (those escalate to a
    super admin), and employees' uploads go to HR.

    Args:
        db: Active database session.
        current_user_id: The user id of the reviewer requesting the list.

    Returns:
        List of dictionaries containing document data and employee names.
    """
    from app.documents.services.approval_routing import (
        get_super_admin_user_ids, eligible_handlers_from_sets,
    )
    from app.notifications.service import get_user_ids_with_permission

    documents = (
        db.query(EmployeeDocument, Employee)
        .join(Employee, Employee.id == EmployeeDocument.employee_id)
        .filter(EmployeeDocument.status == DocumentStatus.PENDING_REVIEW)
        .order_by(EmployeeDocument.uploaded_at.desc())
        .all()
    )

    # Resolve approver/super-admin sets once, then filter each document.
    approver_ids = set(get_user_ids_with_permission(db, "document:approve"))
    super_admin_ids = get_super_admin_user_ids(db)

    result = []
    for doc, emp in documents:
        eligible = eligible_handlers_from_sets(emp.user_id, approver_ids, super_admin_ids)
        if current_user_id not in eligible:
            continue
        result.append({
            "id": doc.id,
            "employee_id": doc.employee_id,
            "employee_name": f"{emp.first_name} {emp.last_name}",
            "document_type": doc.document_type,
            "file_name": doc.file_name,
            # Return a ready-to-use URL (local: /uploads/..., S3: presigned URL)
            # rather than the raw storage key, so the HR preview iframe can load it.
            "file_path": storage.get_url(doc.file_path) if doc.file_path else None,
            "status": doc.status,
            "uploaded_at": doc.uploaded_at
        })
    return result


def approve_document(db: Session, document_id: UUID, reviewer_id: int, current_user_id: int) -> EmployeeDocument:
    """Approve a pending employee document.

    Args:
        db: Active database session.
        document_id: UUID of the document to approve.
        reviewer_id: Employee ID of the HR user approving the document.
        current_user_id: User id of the reviewer (for separation-of-duties check).

    Returns:
        The updated EmployeeDocument ORM object.

    Raises:
        HTTPException 404: If document is not found.
        HTTPException 400: If document is already approved/rejected.
        HTTPException 403: If the reviewer is not allowed to handle this upload.
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

    _ensure_can_review(db, document.employee_id, current_user_id)

    old_status_val = document.status.value
    document.status = DocumentStatus.APPROVED
    document.reviewed_by = reviewer_id
    document.reviewed_at = datetime.utcnow()

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

        # ── Notify requesting employee ────────────────────────────────────
        try:
            from app.notifications.service import notify_employee
            notify_employee(
                db, document.employee_id,
                f"Your {document.document_type} upload was approved",
                category="document", type="success", link="/dashboard/documents",
                entity_type="employee_document", entity_id=str(document.id),
            )
            db.commit()
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"[Approval] Notification failed for approve: {e}")

        return document
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to approve document."
        ) from exc


def reject_document(db: Session, document_id: UUID, reviewer_id: int, reason: str, current_user_id: int) -> EmployeeDocument:
    """Reject a pending employee document and notify the employee.

    Args:
        db: Active database session.
        document_id: UUID of the document to reject.
        reviewer_id: Employee ID of the HR user rejecting the document.
        reason: Text explaining why the document was rejected.
        current_user_id: User id of the reviewer (for separation-of-duties check).

    Returns:
        The updated EmployeeDocument ORM object.

    Raises:
        HTTPException 404: If document is not found.
        HTTPException 400: If document is already approved/rejected.
        HTTPException 403: If the reviewer is not allowed to handle this upload.
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

    _ensure_can_review(db, document.employee_id, current_user_id)

    old_status_val = document.status.value
    document.status = DocumentStatus.REJECTED
    document.reviewed_by = reviewer_id
    document.reviewed_at = datetime.utcnow()
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
    
    # ── Notify requesting employee ────────────────────────────────────
    try:
        from app.notifications.service import notify_employee
        notify_employee(
            db, document.employee_id,
            f"Your {document.document_type} upload was rejected: {reason}",
            category="document", type="error", link="/dashboard/documents",
            entity_type="employee_document", entity_id=str(document.id),
        )
        db.commit()
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"[Approval] Notification failed for reject: {e}")

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