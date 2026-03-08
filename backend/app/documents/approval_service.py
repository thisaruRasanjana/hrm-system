from sqlalchemy.orm import Session
from datetime import datetime
from uuid import UUID

from app.documents.model import EmployeeDocument, DocumentStatus


# Get all documents pending review
def get_pending_documents(db: Session):

    documents = (
        db.query(EmployeeDocument)
        .filter(EmployeeDocument.status == DocumentStatus.PENDING_REVIEW)
        .order_by(EmployeeDocument.uploaded_at.desc())
        .all()
    )

    result = []

    for doc in documents:
        result.append({
            "id": str(doc.id),
            "employee_id": str(doc.employee_id),
            "document_type": doc.document_type,
            "file_path": doc.file_path,
            "status": doc.status.value,
            "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None
        })

    return result


# Approve a document
def approve_document(document_id: UUID, reviewer_id: UUID, db: Session):

    document = (
        db.query(EmployeeDocument)
        .filter(EmployeeDocument.id == document_id)
        .first()
    )

    if not document:
        return None

    document.status = DocumentStatus.APPROVED
    document.reviewed_by = reviewer_id
    document.reviewed_at = datetime.utcnow()

    db.commit()
    db.refresh(document)

    return document


# Reject a document
def reject_document(document_id: UUID, reviewer_id: UUID, reason: str, db: Session):

    document = (
        db.query(EmployeeDocument)
        .filter(EmployeeDocument.id == document_id)
        .first()
    )

    if not document:
        return None

    document.status = DocumentStatus.REJECTED
    document.reviewed_by = reviewer_id
    document.reviewed_at = datetime.utcnow()
    document.rejection_reason = reason

    db.commit()
    db.refresh(document)

    return document