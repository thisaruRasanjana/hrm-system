"""
documents/routers/employee_docs_router.py
=========================================
Router for the HR "Employee Documents" browser.

Gives users holding document:view_employee_docs a read-only view of any
employee's uploaded documents (all statuses, not just pending review) and
their document requests — including inactive employees, whose records must
stay reachable after they leave. Soft-deleted employees are excluded.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.deps import require_permission
from app.core.storage_service import storage
from app.database.database import get_db
from app.documents.models.model import EmployeeDocument
from app.documents.models.request_model import DocumentRequest
from app.documents.schemas import employee_docs_schema as schema
from app.employees.models import Employee

router = APIRouter(
    prefix="/documents/employees",
    tags=["Employee Documents Browser"],
    dependencies=[Depends(require_permission("document:view_employee_docs"))],
)


def _not_deleted():
    return (Employee.is_deleted == False) | (Employee.is_deleted == None)  # noqa: E712, E711


def _summary(emp: Employee, uploaded_count: int = 0, request_count: int = 0) -> dict:
    return {
        "id": emp.id,
        "employee_id": emp.employee_id,
        "first_name": emp.first_name,
        "last_name": emp.last_name,
        "department": emp.department_rel.name if emp.department_rel else None,
        "designation": emp.designation,
        "status": emp.status.value if emp.status else "active",
        "uploaded_count": uploaded_count,
        "request_count": request_count,
    }


def _get_employee_or_404(db: Session, employee_id: int) -> Employee:
    emp = (
        db.query(Employee)
        .options(joinedload(Employee.department_rel))
        .filter(Employee.id == employee_id, _not_deleted())
        .first()
    )
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    return emp


@router.get("/", response_model=list[schema.EmployeeDocsSummary])
def list_employees_with_documents(
    status_filter: str = "all",
    db: Session = Depends(get_db),
):
    """List non-deleted employees with their document counts.

    status_filter: 'active', 'inactive' or 'all'.
    """
    query = (
        db.query(Employee)
        .options(joinedload(Employee.department_rel))
        .filter(_not_deleted())
    )
    if status_filter in ("active", "inactive"):
        query = query.filter(Employee.status == status_filter)
    employees = query.order_by(Employee.first_name, Employee.last_name).all()

    uploaded_counts = dict(
        db.query(EmployeeDocument.employee_id, func.count(EmployeeDocument.id))
        .group_by(EmployeeDocument.employee_id)
        .all()
    )
    request_counts = dict(
        db.query(DocumentRequest.employee_id, func.count(DocumentRequest.id))
        .filter(DocumentRequest.employee_id.isnot(None))
        .group_by(DocumentRequest.employee_id)
        .all()
    )

    return [
        _summary(emp, uploaded_counts.get(emp.id, 0), request_counts.get(emp.id, 0))
        for emp in employees
    ]


@router.get("/{employee_id}/documents", response_model=schema.EmployeeDocsDetail)
def get_employee_document_details(
    employee_id: int,
    db: Session = Depends(get_db),
):
    """Return an employee's uploaded documents (all statuses) and document requests."""
    emp = _get_employee_or_404(db, employee_id)

    uploads = (
        db.query(EmployeeDocument)
        .filter(EmployeeDocument.employee_id == employee_id)
        .order_by(EmployeeDocument.uploaded_at.desc())
        .all()
    )
    requests = (
        db.query(DocumentRequest)
        .filter(DocumentRequest.employee_id == employee_id)
        .order_by(DocumentRequest.created_at.desc())
        .all()
    )

    return {
        "employee": _summary(emp, len(uploads), len(requests)),
        "uploaded_documents": [
            {
                "id": doc.id,
                "document_type": doc.document_type,
                "is_mandatory": doc.is_mandatory,
                "file_name": doc.file_name,
                "file_url": storage.get_url(doc.file_path) if doc.file_path else None,
                "status": doc.status.value,
                "uploaded_at": doc.uploaded_at,
                "reviewed_at": doc.reviewed_at,
                "rejection_reason": doc.rejection_reason,
            }
            for doc in uploads
        ],
        "requested_documents": [
            {
                "id": req.id,
                "document_type": req.document_type,
                "reason": req.reason,
                "status": req.status,
                "source": req.source,
                "created_at": req.created_at,
                "rejection_reason": req.rejection_reason,
                "generated_document_url": storage.get_url(req.generated_document_path)
                if req.generated_document_path else None,
            }
            for req in requests
        ],
    }


@router.get("/download/{document_id}")
def download_any_employee_document(
    document_id: UUID,
    db: Session = Depends(get_db),
):
    """Download an uploaded document on behalf of HR (no ownership restriction)."""
    document = db.query(EmployeeDocument).filter(EmployeeDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Block access through soft-deleted employees — their records are meant to vanish
    emp_exists = (
        db.query(Employee.id)
        .filter(Employee.id == document.employee_id, _not_deleted())
        .first()
    )
    if not emp_exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if not storage.file_exists(document.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on server")

    return storage.serve(document.file_path, document.file_name)
