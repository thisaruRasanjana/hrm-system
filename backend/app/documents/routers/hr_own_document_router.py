from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session
from uuid import UUID

from app.database.database import get_db
from app.documents.schemas import schemas, request_schema
from app.documents.services import service, request_service

router = APIRouter(
    tags=["HR Own Documents"]
)

@router.post("/hr-own-documents/upload", response_model=schemas.DocumentUploadResponse)
def upload_hr_document(
    employee_id: int = Form(...),
    document_type: str = Form(...),
    is_mandatory: bool = Form(False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    return service.upload_employee_document(
        db=db,
        employee_id=employee_id,
        document_type=document_type,
        is_mandatory=is_mandatory,
        file=file
    )

@router.get(
    "/hr-own-documents/my-documents",
    response_model=list[schemas.EmployeeDocumentResponse]
)
def get_hr_my_documents(
    hr_id: int,
    db: Session = Depends(get_db)
):
    return service.get_employee_documents(db, hr_id)


@router.post("/hr-own-document-requests/", response_model=request_schema.RequestResponse)
def create_hr_request(
    data: request_schema.CreateRequest,
    db: Session = Depends(get_db)
):
    return request_service.create_document_request(db, data)


@router.get("/hr-own-document-requests/{hr_id}", response_model=list[request_schema.RequestResponse])
def get_hr_requests(
    hr_id: int,
    db: Session = Depends(get_db)
):
    return request_service.get_employee_requests(db, hr_id)
