from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from uuid import UUID

from app.database.database import get_db
from app.documents.schemas import approval_schema
from app.documents.services import approval_service
from app.auth.dependencies import require_permission
from app.documents.constants import DEMO_REVIEWER_ID

router = APIRouter(
    prefix="/documents/review",
    tags=["Document Approval"]
)


@router.get("/pending", response_model=list[approval_schema.DocumentApprovalResponse])
def get_pending_documents(
    db: Session = Depends(get_db)
):
    return approval_service.get_pending_documents(db)


@router.patch("/{document_id}/approve", response_model=approval_schema.DocumentApprovalResponse)
def approve_document(
    document_id: UUID,
    db: Session = Depends(get_db)
):
    return approval_service.approve_document(db, document_id, DEMO_REVIEWER_ID)


@router.patch("/{document_id}/reject", response_model=approval_schema.DocumentApprovalResponse)
def reject_document(
    document_id: UUID,
    request: approval_schema.RejectDocumentRequest,
    db: Session = Depends(get_db)
):
    return approval_service.reject_document(db, document_id, DEMO_REVIEWER_ID, request.reason)