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
from app.core.deps import get_current_user, require_permission

router = APIRouter(
    prefix="/hr-document-requests",
    tags=["HR Document Requests"]
)


@router.get("/", response_model=hr_request_schema.HRGetRequestsResponse)
def get_all_hr_requests(
    filter_status: str = None,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:request_manage"))
):
    """List the document requests this manager is allowed to handle."""
    requests = hr_request_service.get_all_hr_requests(db, current_user.id, filter_status)
    return {"data": requests}


@router.post("/{request_id}/generate")
def generate_document(
    request_id: UUID,
    data: hr_request_schema.HRGenerateDocumentRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:template_upload"))
):
    """Generate a document from a template for a specific request."""
    from app.documents.models.request_model import DocumentRequest
    doc_req = db.query(DocumentRequest).filter(DocumentRequest.id == request_id).first()
    if not doc_req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    hr_request_service.ensure_can_handle_request(db, doc_req, current_user.id)
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


@router.post("/poll-inbox")
async def poll_inbox_now(
    current_user = Depends(require_permission("document:request_manage"))
):
    """Run ONE inbound-email poll cycle immediately instead of waiting for the
    scheduled interval.

    Exists so QA can trigger the external-request flow on demand. Import is
    idempotent (deduped on the email's Message-ID), so calling this repeatedly
    is safe and will not create duplicate requests.
    """
    from app.core.scheduler import poll_email_inbox

    # force=True: the operator explicitly asked THIS process to do the work, so
    # skip the advisory lock that would otherwise defer to another worker.
    created = await poll_email_inbox(force=True)
    return {
        "created": created,
        "detail": f"Poll cycle complete — {created} new external request(s) imported.",
    }


@router.patch("/{request_id}/status")
def update_request_status(
    request_id: UUID,
    data: hr_request_schema.HRRequestStatusUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:request_manage"))
):
    """Update the status of a document request (e.g. to IN_PROGRESS or REJECTED)."""
    return hr_request_service.update_request_status(
        db,
        request_id,
        data.status,
        data.rejection_reason,
        current_user.id,
    )


@router.post("/{request_id}/assign-employee")
def assign_employee(
    request_id: UUID,
    employee_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:request_manage"))
):
    """Link an existing employee to an external email request.

    The response carries ``escalated``/``warning`` when the assignment has routed
    the request away from the caller (i.e. it is about them), so the UI can
    explain the loss of access instead of the caller hitting a bare 403 later.
    """
    return hr_request_service.assign_employee_to_request(
        db, request_id, employee_id, current_user.id,
    )


@router.post("/{request_id}/custom-letter")
def send_custom_letter(
    request_id: UUID,
    data: hr_request_schema.HRCustomLetterRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:template_upload"))
):
    """Generate a PDF letter from raw/edited HTML and mark the request COMPLETED."""
    from app.documents.models.request_model import DocumentRequest, RequestStatus
    doc_request = db.query(DocumentRequest).filter(DocumentRequest.id == request_id).first()
    if not doc_request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    hr_request_service.ensure_can_handle_request(db, doc_request, current_user.id)

    final_path, html_content = document_generator.generate_from_custom_text(
        str(request_id),
        data.content,
        preserve_whitespace=data.preserve_whitespace,
    )

    doc_request.status = RequestStatus.COMPLETED
    doc_request.generated_document_path = final_path.replace("\\", "/") if final_path else None
    db.commit()
    db.refresh(doc_request)

    # Deliver the custom letter to external requesters, same as template generation.
    document_generator.notify_external_requester(doc_request, doc_request.generated_document_path)

    return {
        "message": "Custom letter generated successfully",
        "document_path": doc_request.generated_document_path
    }
