from app.documents.schemas import request_schema
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from uuid import UUID

from app.database.database import get_db
from app.documents.services import request_service

router = APIRouter(
    prefix="/document-requests",
    tags=["Document Requests"]
)


@router.post("/", response_model=request_schema.RequestResponse)
def create_request(
    data: request_schema.CreateRequest,
    db: Session = Depends(get_db)
):
    return request_service.create_document_request(db, data)


@router.get("/{employee_id}", response_model=list[request_schema.RequestResponse])
def get_requests(
    employee_id: int,
    db: Session = Depends(get_db)
):
    return request_service.get_employee_requests(db, employee_id)