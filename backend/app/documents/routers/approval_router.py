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
from app.auth.dependencies import require_permission

router = APIRouter(prefix="/documents/review", tags=["Document Approval"])


@router.get("/pending")
def pending_documents(db: Session = Depends(get_db), current_user = Depends(require_permission("document:approve"))):
    return get_pending_documents(db, current_user)


@router.put("/{document_id}/approve")
def approve(document_id: UUID, db: Session = Depends(get_db), current_user = Depends(require_permission("document:approve"))):
    reviewer_id = current_user.id
    return approve_document(document_id, reviewer_id, db)


@router.put("/{document_id}/reject")
def reject(
    document_id: UUID,
    data: RejectDocumentRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:approve"))
):
    reviewer_id = current_user.id
    return reject_document(
        document_id,
        reviewer_id,
        data.reason,
        db
    )