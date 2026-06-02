import app.documents.schemas.request_schema as request_schema
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.documents.services import request_service
from app.auth.dependencies import get_current_user, require_permission

router = APIRouter(
    prefix="/document-requests",
    tags=["Document Requests"]
)

@router.post("/", response_model=request_schema.RequestResponse)
def create_request(
    data: request_schema.CreateRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:view"))
):
    return request_service.create_document_request(db, data)

@router.get("/", response_model=list[request_schema.RequestResponse])
def get_all_requests(
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:view"))
):
    return request_service.get_all_requests(db)

@router.get("/my", response_model=list[request_schema.RequestResponse])
def get_my_requests(
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:view"))
):
    employee_id = current_user.employee.id if current_user.employee else current_user.id
    return request_service.get_employee_requests(db, employee_id)