from sqlalchemy.orm import Session
from datetime import datetime
from uuid import UUID

from app.documents.models.model import EmployeeDocument, DocumentStatus
from app.employees.models import Employee


# Get all pending documents
def get_pending_documents(db: Session):

    documents = (
        db.query(EmployeeDocument, Employee)
        .outerjoin(Employee, Employee.id == EmployeeDocument.employee_id)
        .filter(EmployeeDocument.status == DocumentStatus.PENDING_REVIEW)
        .order_by(EmployeeDocument.uploaded_at.desc())
        .all()
    )

    result = []

    for doc, emp in documents:

        employee_name = "Unknown Employee"

        if emp:
            employee_name = f"{emp.first_name} {emp.last_name}"

        result.append({
            "id": str(doc.id),
            "employee_id": str(doc.employee_id),
            "employee_name": employee_name,
            "document_type": doc.document_type,
            "file_path": doc.file_path,
            "status": doc.status.value,
            "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None
        })

    return result


# Approve document
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


# Reject document
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