import app.documents.schemas.request_schema as request_schema
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from uuid import UUID

from app.database.database import get_db
from app.documents.services import request_service
from app.core.deps import require_permission, get_current_user

router = APIRouter(
    prefix="/document-requests",
    tags=["Document Requests"]
)

@router.post("/", response_model=request_schema.RequestResponse)
def create_request(
    data: request_schema.CreateRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:request"))
):
    return request_service.create_document_request(db, data)

@router.get("/", response_model=list[request_schema.RequestResponse])
def get_all_requests(
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:view"))
):
    return request_service.get_all_requests(db)

@router.get("/{employee_id}", response_model=list[request_schema.RequestResponse])
def get_employee_requests(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:view"))
):
    # Depending on your specific RBAC design, a user might only be able to view their own
    # requests if they don't have global document:view permission. Here we enforce `document:view`.
    return request_service.get_employee_requests(db, employee_id)