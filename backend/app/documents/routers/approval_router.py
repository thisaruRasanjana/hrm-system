from uuid import UUID

from app.database.database import get_db
from app.documents.schemas.approval_schema import RejectDocumentRequest
from app.documents.services.approval_service import (
    approve_document,
    get_pending_documents,
    reject_document,
)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.deps import require_permission

router = APIRouter(tags=["Document Approval"])


@router.get("/pending")
def pending_documents(db: Session = Depends(get_db), current_user = Depends(require_permission("document:approve"))):
    return get_pending_documents(db)


@router.patch("/{document_id}/approve")
def approve(document_id: UUID, db: Session = Depends(get_db), current_user = Depends(require_permission("document:approve"))):
    reviewer_id = current_user.id
    doc = approve_document(document_id, reviewer_id, db)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document approved successfully", "status": "APPROVED"}


@router.patch("/{document_id}/reject")
def reject(
    document_id: UUID,
    data: RejectDocumentRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:approve"))
):
    reviewer_id = current_user.id
    doc = reject_document(document_id, reviewer_id, data.reason, db)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {
        "message": "Document rejected",
        "status": "REJECTED",
        "reason": data.reason,
    }
