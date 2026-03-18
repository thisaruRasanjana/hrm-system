from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.database.database import get_db
from app.documents.services import hr_request_service
from app.documents.services import document_generator
from app.documents.schemas import hr_request_schema
from app.documents.models.request_model import RequestStatus

router = APIRouter(
    prefix="/hr-document-requests",
    tags=["HR Document Requests"]
)

@router.get("/", response_model=list[hr_request_schema.HRRequestResponse])
def get_requests(
    status: Optional[str] = Query(None, description="Filter by status (NEW, IN_PROGRESS, COMPLETED, etc)"),
    db: Session = Depends(get_db)
):
    # Mapping "NEW" from frontend to "PENDING" in DB, if needed, but normally frontend sends PENDING.
    db_status = "PENDING" if status == "NEW" else status
    return hr_request_service.get_all_hr_requests(db, db_status)

@router.put("/{request_id}/status")
def update_status(
    request_id: UUID,
    data: hr_request_schema.HRRequestStatusUpdate,
    db: Session = Depends(get_db)
):
    req = hr_request_service.update_request_status(
        db=db,
        request_id=request_id,
        status=data.status,
        rejection_reason=data.rejection_reason
    )
    return {"message": "Status updated successfully", "status": req.status.value}

@router.post("/{request_id}/generate")
def generate_document(
    request_id: UUID,
    data: hr_request_schema.HRGenerateDocumentRequest,
    db: Session = Depends(get_db)
):
    try:
        req, html_content = document_generator.generate_document_from_request(
            db=db,
            request_id=request_id,
            template_id=data.template_id,
            preview=data.preview
        )
        return {
            "message": "Document generated successfully",
            "document_path": req.generated_document_path,
            "preview_html": html_content
        }
    except ValueError as e:
        return {"error": str(e)}
