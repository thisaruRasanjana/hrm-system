from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from uuid import UUID

from app.database.database import get_db
from app.documents.schemas import approval_schema
from app.documents.services import approval_service
from app.core.deps import get_current_user, require_permission
from app.employees.models import Employee

router = APIRouter(
    prefix="/documents/review",
    tags=["Document Approval"]
)


@router.get("/pending", response_model=list[approval_schema.DocumentApprovalResponse])
def get_pending_documents(
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:approve"))
):
    return approval_service.get_pending_documents(db, current_user.id)


@router.patch("/{document_id}/approve", response_model=approval_schema.DocumentApprovalResponse)
def approve_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:approve"))
):
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    reviewer_id = emp.id if emp else current_user.id
    return approval_service.approve_document(db, document_id, reviewer_id, current_user.id)


@router.patch("/{document_id}/reject", response_model=approval_schema.DocumentApprovalResponse)
def reject_document(
    document_id: UUID,
    request: approval_schema.RejectDocumentRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:approve"))
):
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    reviewer_id = emp.id if emp else current_user.id
    return approval_service.reject_document(db, document_id, reviewer_id, request.reason, current_user.id)