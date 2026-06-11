from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from uuid import UUID

from app.database.database import get_db
from app.documents.schemas import schemas, request_schema
from app.documents.services import service, request_service
from app.core.deps import require_permission
from app.employees.models import Employee

router = APIRouter(
    tags=["HR Own Documents"]
)

def _get_employee_id(current_user, db: Session) -> int | None:
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    return emp.id if emp else None

@router.post("/hr-own-documents/upload", response_model=schemas.DocumentUploadResponse)
def upload_hr_document(
    document_type_id: UUID = Form(...),
    is_mandatory: bool = Form(False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:upload_own"))
):
    emp_id = _get_employee_id(current_user, db)
    if emp_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No employee profile linked to your account.")
    return service.upload_employee_document(
        db=db,
        employee_id=emp_id,
        document_type_id=document_type_id,
        is_mandatory=is_mandatory,
        file=file
    )

@router.get(
    "/hr-own-documents/my-documents",
    response_model=list[schemas.EmployeeDocumentResponse]
)
def get_hr_my_documents(
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:upload_own"))
):
    emp_id = _get_employee_id(current_user, db)
    if emp_id is None:
        return []
    return service.get_employee_documents(db, emp_id)


@router.post("/hr-own-document-requests/", response_model=request_schema.RequestResponse)
def create_hr_request(
    data: request_schema.CreateRequestInput,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:request_own"))
):
    emp_id = _get_employee_id(current_user, db)
    if emp_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No employee profile linked to your account.")
    full_data = request_schema.CreateRequest(
        employee_id=emp_id,
        document_type=data.document_type,
        reason=data.reason,
    )
    return request_service.create_document_request(db, full_data)


@router.get("/hr-own-document-requests/my", response_model=list[request_schema.RequestResponse])
def get_hr_requests(
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:request_own"))
):
    emp_id = _get_employee_id(current_user, db)
    if emp_id is None:
        return []
    return request_service.get_employee_requests(db, emp_id)
