from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from uuid import UUID

from app.database.database import get_db
from app.documents.approval_service import (
    get_pending_documents,
    approve_document,
    reject_document
)

from app.documents.approval_schema import RejectDocumentRequest

router = APIRouter(prefix="/documents/review", tags=["Document Approval"])


@router.get("/pending")
def pending_documents(db: Session = Depends(get_db)):
    return get_pending_documents(db)


@router.put("/{document_id}/approve")
def approve(document_id: UUID, db: Session = Depends(get_db)):

    reviewer_id = None  # Later we will use logged-in HR user

    return approve_document(document_id, reviewer_id, db)


@router.put("/{document_id}/reject")
def reject(
    document_id: UUID,
    data: RejectDocumentRequest,
    db: Session = Depends(get_db)
):

    reviewer_id = None

    return reject_document(
        document_id,
        reviewer_id,
        data.reason,
        db
    )