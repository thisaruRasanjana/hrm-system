"""
documents/services/service.py
=============================
Service layer for employee document uploads and retrieval.

(Note: Named 'service.py' historically; acts as the primary document_service).

Responsibilities:
- Handling file uploads securely (size and MIME type validation).
- Managing document duplicates (deleting old files when re-uploading).
- Retrieving and downloading documents.
"""

import os
from uuid import UUID, uuid4

from fastapi import HTTPException, status, UploadFile
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.responses import Response

from app.documents.models.model import EmployeeDocument, DocumentStatus
from app.documents.models.document_type_model import DocumentType
from app.documents.constants import ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES
from app.core.storage_service import storage


def save_file(file: UploadFile, employee_id: int) -> str:
    """Save an uploaded document using the active storage backend.

    Returns:
        The storage key for the saved file (e.g. "documents/42_abc123.pdf").
        Store this key in EmployeeDocument.file_path.
    """
    ext = os.path.splitext(file.filename or "")[1].lower()
    stored_name = f"{employee_id}_{uuid4().hex}{ext}"
    key = f"documents/{stored_name}"
    content = file.file.read()
    storage.upload(content, key)
    return key


def _handle_duplicate_document(db: Session, employee_id: int, document_type_name: str) -> None:
    """Check for an existing document of the same type and remove it.

    Args:
        db: Active SQLAlchemy database session.
        employee_id: The employee ID.
        document_type_name: The resolved string name of the document type.
    """
    existing_document = (
        db.query(EmployeeDocument)
        .filter(
            EmployeeDocument.employee_id == employee_id,
            EmployeeDocument.document_type == document_type_name
        )
        .first()
    )

    if existing_document:
        if existing_document.file_path:
            storage.delete(existing_document.file_path)

        db.delete(existing_document)
        db.flush()  # Flush so the deletion is applied before the new insert


def upload_employee_document(
    db: Session,
    employee_id: int,
    document_type_id: UUID,
    is_mandatory: bool,
    file: UploadFile
) -> EmployeeDocument:
    """Upload a new document for an employee.

    Validates file type and size. Replaces any existing document of the same type.

    Args:
        db: Active database session.
        employee_id: ID of the employee.
        document_type_id: UUID of the DocumentType catalogue entry.
        is_mandatory: Whether this document is required.
        file: The uploaded file.

    Returns:
        The created EmployeeDocument ORM object.

    Raises:
        HTTPException 400: If file is too large or invalid type.
        HTTPException 404: If document type is invalid.
        HTTPException 500: If database commit fails.
    """
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF, JPG, and PNG files are allowed"
        )

    # Validate file size by reading to the end, then seeking back to 0
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    
    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum allowed size of {MAX_FILE_SIZE_BYTES // (1024*1024)}MB"
        )

    doc_type_obj = db.query(DocumentType).filter(DocumentType.id == document_type_id).first()
    if not doc_type_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid document type")

    document_type_name = doc_type_obj.name

    try:
        _handle_duplicate_document(db, employee_id, document_type_name)

        file_path = save_file(file, employee_id)

        new_document = EmployeeDocument(
            employee_id=employee_id,
            document_type=document_type_name,
            is_mandatory=is_mandatory,
            file_name=file.filename,
            file_path=file_path,
            status=DocumentStatus.PENDING_REVIEW
        )

        db.add(new_document)
        db.commit()
        db.refresh(new_document)

        # ── Notify the eligible reviewers (separation-of-duties routing) ──
        try:
            from app.notifications.service import notify_users, get_employee_name
            from app.documents.services.approval_routing import (
                get_eligible_handler_user_ids, employee_user_id,
            )
            emp_name = get_employee_name(db, employee_id)
            uploader_uid = employee_user_id(db, employee_id)
            recipients = get_eligible_handler_user_ids(db, uploader_uid, "document:approve")
            notify_users(
                db, recipients,
                f"{emp_name} uploaded a {document_type_name} for review",
                category="document", type="info", link="/dashboard/documents/approval",
                entity_type="employee_document", entity_id=str(new_document.id),
            )
            db.commit()
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"[Documents] Notification failed for upload: {e}")

        return new_document
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save document. Please try again."
        ) from exc


def get_employee_documents(db: Session, employee_id: int) -> list[EmployeeDocument]:
    """Retrieve all uploaded documents for a specific employee.

    Args:
        db: Active database session.
        employee_id: ID of the employee.

    Returns:
        List of EmployeeDocument ORM objects.
    """
    return (
        db.query(EmployeeDocument)
        .filter(EmployeeDocument.employee_id == employee_id)
        .order_by(EmployeeDocument.uploaded_at.desc())
        .all()
    )


def download_employee_document(
    db: Session,
    document_id: UUID,
    employee_id: int
) -> Response:
    """Download an employee document, verifying access rights.

    Args:
        db: Active database session.
        document_id: UUID of the document to download.
        employee_id: ID of the requesting employee (for access control).

    Returns:
        Response serving the document.

    Raises:
        HTTPException 404: If the document doesn't exist or isn't accessible.
    """
    document = (
        db.query(EmployeeDocument)
        .filter(
            EmployeeDocument.id == document_id,
            EmployeeDocument.employee_id == employee_id
        )
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied"
        )

    if not storage.file_exists(document.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found on server"
        )

    return storage.serve(document.file_path, document.file_name)
