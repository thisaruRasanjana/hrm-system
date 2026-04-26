"""
documents/routers/hr_request_router.py
=======================================
Router for HR document request operations.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.documents.schemas import hr_request_schema
from app.documents.services import hr_request_service, document_generator
from app.auth.dependencies import require_permission

router = APIRouter(
    prefix="/hr-document-requests",
    tags=["HR Document Requests"]
)


@router.get("/", response_model=hr_request_schema.HRGetRequestsResponse)
def get_all_hr_requests(
    filter_status: str = None,
    db: Session = Depends(get_db)
):
    """List all document requests with their linked employee details."""
    requests = hr_request_service.get_all_hr_requests(db, filter_status)
    return {"data": requests}


@router.post("/{request_id}/generate")
def generate_document(
    request_id: UUID,
    data: hr_request_schema.HRGenerateDocumentRequest,
    db: Session = Depends(get_db)
):
    """Generate a document from a template for a specific request."""
    try:
        req, html_content = document_generator.generate_document_from_request(
            db=db,
            request_id=request_id,
            template_id=data.template_id,
            preview=data.preview,
            override_reason=data.override_reason
        )
        return {
            "message": "Document generated successfully",
            "document_path": getattr(req, "generated_document_path", None),
            "preview_html": html_content
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.patch("/{request_id}/status")
def update_request_status(
    request_id: UUID,
    data: hr_request_schema.HRRequestStatusUpdate,
    db: Session = Depends(get_db)
):
    """Update the status of a document request (e.g. to IN_PROGRESS or REJECTED)."""
    return hr_request_service.update_request_status(
        db,
        request_id,
        data.status,
        data.rejection_reason
    )


@router.post("/{request_id}/assign-employee")
def assign_employee(
    request_id: UUID,
    employee_id: int,
    db: Session = Depends(get_db)
):
    """Link an existing employee to an external email request."""
    return hr_request_service.assign_employee_to_request(db, request_id, employee_id)


@router.post("/{request_id}/custom-letter")
def send_custom_letter(
    request_id: UUID,
    content: str,
    db: Session = Depends(get_db)
):
    """Generate a completely custom PDF letter and mark the request COMPLETED."""
    final_path, html_content = document_generator.generate_from_custom_text(
        str(request_id),
        content
    )

    from app.documents.models.request_model import DocumentRequest, RequestStatus
    doc_request = db.query(DocumentRequest).filter(DocumentRequest.id == request_id).first()
    if not doc_request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    doc_request.status = RequestStatus.COMPLETED
    doc_request.generated_document_path = final_path.replace("\\", "/") if final_path else None
    db.commit()

    return {
        "message": "Custom letter generated successfully",
        "document_path": doc_request.generated_document_path
    }
