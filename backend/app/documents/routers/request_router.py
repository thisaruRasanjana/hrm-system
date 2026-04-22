import app.documents.schemas.request_schema as request_schema
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.database.database import get_db
from app.documents.services import request_service
from app.auth.dependencies import require_permission

router = APIRouter(
    prefix="/document-requests",
    tags=["Document Requests"]
)

@router.get("/", response_model=List[request_schema.RequestResponse])
def get_all_requests(
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("document:manage_requests"))
):
    """HR: list all document requests."""
    return request_service.get_all_requests(db)

@router.post("/", response_model=request_schema.RequestResponse)
def create_request(
    data: request_schema.CreateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("document:request"))
):
    return request_service.create_document_request(db, data)

@router.get("/{employee_id}", response_model=List[request_schema.RequestResponse])
def get_requests(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("document:request"))
):
    """Employee: list their own document requests."""
    return request_service.get_employee_requests(db, employee_id)