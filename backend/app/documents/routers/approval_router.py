from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from uuid import UUID

from app.database.database import get_db
from app.documents.services.approval_service import (
    get_pending_documents,
    approve_document,
    reject_document
)

from app.documents.schemas.approval_schema import RejectDocumentRequest
from app.core.deps import require_permission

router = APIRouter(prefix="/documents/review", tags=["Document Approval"])


@router.get("/pending")
def pending_documents(db: Session = Depends(get_db)):
    return get_pending_documents(db)


@router.patch("/{document_id}/approve")
def approve(document_id: UUID, db: Session = Depends(get_db)):
    reviewer_id = 1 # Hardcoded for demo
    return approve_document(document_id, reviewer_id, db)


@router.patch("/{document_id}/reject")
def reject(
    document_id: UUID,
    data: RejectDocumentRequest,
    db: Session = Depends(get_db)
):
    reviewer_id = 1 # Hardcoded for demo
    return reject_document(
        document_id,
        reviewer_id,
        data.reason,
        db
    )