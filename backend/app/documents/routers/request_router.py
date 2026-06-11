import app.documents.schemas.request_schema as request_schema
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.documents.services import request_service
from app.core.deps import get_current_user, require_permission
from app.employees.models import Employee

router = APIRouter(
    prefix="/document-requests",
    tags=["Document Requests"]
)

@router.post("/", response_model=request_schema.RequestResponse)
def create_request(
    data: request_schema.CreateRequestInput,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:request_own"))
):
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee profile not found. Contact HR.")
    full_data = request_schema.CreateRequest(
        employee_id=emp.id,
        document_type=data.document_type,
        reason=data.reason,
    )
    return request_service.create_document_request(db, full_data)

@router.get("/", response_model=list[request_schema.RequestResponse])
def get_all_requests(
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:request_manage"))
):
    return request_service.get_all_requests(db)

@router.get("/my", response_model=list[request_schema.RequestResponse])
def get_my_requests(
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:request_own"))
):
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee profile not found")
    return request_service.get_employee_requests(db, emp.id)