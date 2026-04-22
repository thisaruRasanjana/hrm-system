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

@router.post("/sync-emails")
async def sync_emails(db: Session = Depends(get_db)):
    import asyncio
    from app.documents.services import email_service
    result = await asyncio.to_thread(email_service.fetch_and_process_external_requests, db)
    return result


@router.put("/{request_id}/assign-employee")
def assign_employee(
    request_id: UUID,
    data: dict,
    db: Session = Depends(get_db)
):
    employee_id = int(data["employee_id"])
    return hr_request_service.assign_employee_to_request(db, request_id, employee_id)


@router.post("/{request_id}/custom-letter")
def send_custom_letter(request_id: UUID, data: dict, db: Session = Depends(get_db)):
    """Generate a PDF from free-form letter text written by HR, and mark request COMPLETED."""
    import os
    from xhtml2pdf import pisa
    from app.documents.models.request_model import DocumentRequest, RequestStatus

    content = data.get("content", "").strip()
    if not content:
        return {"error": "Letter content cannot be empty"}

    doc_request = db.query(DocumentRequest).filter(DocumentRequest.id == request_id).first()
    if not doc_request:
        return {"error": "Request not found"}

    # Wrap the custom text in a clean printable HTML page
    html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page {{ margin: 60px; }}
    body {{ font-family: 'Arial', sans-serif; font-size: 13px; line-height: 1.8; color: #333; }}
    .letter-body {{ white-space: pre-wrap; word-break: break-word; }}
  </style>
</head>
<body>
  <div class="letter-body">{content}</div>
</body>
</html>"""

    # Save as PDF
    GENERATED_DOCS_DIR = os.path.join("uploads", "generated_documents")
    os.makedirs(GENERATED_DOCS_DIR, exist_ok=True)
    import uuid as _uuid
    pdf_filename = f"custom_{_uuid.uuid4().hex[:8]}.pdf"
    pdf_path = os.path.join(GENERATED_DOCS_DIR, pdf_filename)

    with open(pdf_path, "wb") as pdf_file:
        pisa_status = pisa.CreatePDF(html, dest=pdf_file)

    if pisa_status.err:
        return {"error": "Failed to generate PDF from custom letter"}

    final_path = pdf_path.replace("\\", "/")
    doc_request.status = RequestStatus.COMPLETED
    doc_request.generated_document_path = final_path
    db.commit()
    db.refresh(doc_request)

    # Auto-email for EXTERNAL requests
    if getattr(doc_request, "source", "INTERNAL") == "EXTERNAL" and doc_request.requester_email:
        try:
            from app.documents.services.email_service import send_document_to_requester
            abs_path = os.path.join(os.getcwd(), final_path.replace("/", os.sep))
            send_document_to_requester(doc_request.requester_email, abs_path, doc_request.document_type)
        except Exception as e:
            print(f"[Custom Letter] Warning: could not email document: {e}")

    return {"message": "Custom letter generated and sent", "document_path": final_path}

