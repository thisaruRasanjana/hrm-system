from app.documents.schemas import schemas
from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session
from uuid import UUID
from fastapi.responses import FileResponse

from app.database.database import get_db
from app.documents.services import service
from app.core.deps import require_permission

router = APIRouter(
    prefix="",
    tags=["Documents"]
)

@router.post("/upload", response_model=schemas.DocumentUploadResponse)
def upload_document(
    employee_id: int = Form(...),
    document_type_id: UUID = Form(...),
    is_mandatory: bool = Form(False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
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
    employee_id: int,
    db: Session = Depends(get_db)
):
    return service.get_employee_documents(db, employee_id)

@router.get("/download/{document_id}")
def download_document(
    document_id: UUID,
    employee_id: int,
    db: Session = Depends(get_db)
):
    return service.download_employee_document(
        db=db,
        document_id=document_id,
        employee_id=employee_id
    )
