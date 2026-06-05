from app.documents.schemas import schemas
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from uuid import UUID

from app.database.database import get_db
from app.documents.services import service
from app.core.deps import get_current_user, require_permission
from app.employees.models import Employee

router = APIRouter(
    prefix="/documents",
    tags=["Documents"]
)

def _get_employee_id(current_user, db: Session) -> int:
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee profile not found")
    return emp.id

@router.post("/upload", response_model=schemas.DocumentUploadResponse)
def upload_document(
    document_type_id: UUID = Form(...),
    is_mandatory: bool = Form(False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:upload_own"))
):
    return service.upload_employee_document(
        db=db,
        employee_id=_get_employee_id(current_user, db),
        document_type_id=document_type_id,
        is_mandatory=is_mandatory,
        file=file
    )

@router.get("/my-documents", response_model=list[schemas.EmployeeDocumentResponse])
def get_my_documents(
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:upload_own"))
):
    return service.get_employee_documents(db, _get_employee_id(current_user, db))

@router.get("/download/{document_id}")
def download_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:upload_own"))
):
    return service.download_employee_document(
        db=db,
        document_id=document_id,
        employee_id=_get_employee_id(current_user, db)
    )
