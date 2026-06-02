from app.documents.schemas import schemas
from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session
from uuid import UUID
from fastapi.responses import FileResponse

from app.database.database import get_db
from app.documents.services import service
from app.auth.dependencies import get_current_user, require_permission

router = APIRouter(
    prefix="/documents",
    tags=["Documents"]
)

@router.post("/upload", response_model=schemas.DocumentUploadResponse)
def upload_document(
    document_type_id: UUID = Form(...),
    is_mandatory: bool = Form(False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:upload"))
):
    employee_id = current_user.employee.id if current_user.employee else current_user.id
    return service.upload_employee_document(
        db=db,
        employee_id=employee_id,
        document_type_id=document_type_id,
        is_mandatory=is_mandatory,
        file=file
    )

@router.get(
    "/my-documents",
    response_model=list[schemas.EmployeeDocumentResponse]
)
def get_my_documents(
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:view"))
):
    employee_id = current_user.employee.id if current_user.employee else current_user.id
    return service.get_employee_documents(db, employee_id)

@router.get("/download/{document_id}")
def download_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:view"))
):
    employee_id = current_user.employee.id if current_user.employee else current_user.id
    return service.download_employee_document(
        db=db,
        document_id=document_id,
        employee_id=employee_id
    )
