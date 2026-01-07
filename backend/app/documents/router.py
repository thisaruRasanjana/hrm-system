from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session
from uuid import UUID

from app.database.database import get_db
from app.documents import service, schemas

router = APIRouter(prefix="/documents", tags=["Documents"])

@router.post("/upload", response_model=schemas.DocumentUploadResponse)
def upload_document(
    employee_id: UUID = Form(...),
    document_type: str = Form(...),
    is_mandatory: bool = Form(False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    document = service.upload_employee_document(
        db=db,
        employee_id=employee_id,
        document_type=document_type,
        is_mandatory=is_mandatory,
        file=file
    )
    return document

@router.get("/my-documents", response_model=list[schemas.EmployeeDocumentResponse])
def get_my_documents(
    employee_id: UUID,
    db: Session = Depends(get_db)
):
    return service.get_employee_documents(db, employee_id)
