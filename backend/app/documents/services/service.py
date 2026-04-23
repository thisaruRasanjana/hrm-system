import os
from uuid import UUID

from fastapi import UploadFile, HTTPException, status
from sqlalchemy.orm import Session
from starlette.responses import FileResponse

from app.documents.models.model import EmployeeDocument, DocumentStatus

BASE_UPLOAD_DIR = "uploads/documents"

ALLOWED_FILE_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png"
]
def save_file(file: UploadFile, employee_id: int) -> str:
    os.makedirs(BASE_UPLOAD_DIR, exist_ok=True)

    file_path = os.path.join(
        BASE_UPLOAD_DIR,
        f"{employee_id}_{file.filename}"
    )

    with open(file_path, "wb") as buffer:
        buffer.write(file.file.read())

    return file_path

from app.documents.models.document_type_model import DocumentType

def upload_employee_document(
    db: Session,
    employee_id: int,
    document_type_id: UUID,
    is_mandatory: bool,
    file: UploadFile
):
    # ✅ File type validation
    if file.content_type not in ALLOWED_FILE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF, JPG, and PNG files are allowed"
        )

    # Lookup document type name
    doc_type_obj = db.query(DocumentType).filter(DocumentType.id == document_type_id).first()
    if not doc_type_obj:
        raise HTTPException(status_code=404, detail="Invalid document type")
    
    document_type_name = doc_type_obj.name

    # Check if document already exists
    existing_document = (
        db.query(EmployeeDocument)
        .filter(
            EmployeeDocument.employee_id == employee_id,
            EmployeeDocument.document_type == document_type_name
        )
        .first()
    )

    # 🗑 If exists → delete old file + DB record
    if existing_document:
        if os.path.exists(existing_document.file_path):
            os.remove(existing_document.file_path)

        db.delete(existing_document)
        db.commit()

    # Save new file
    file_path = save_file(file, employee_id)

    # 🆕 Create new record
    new_document = EmployeeDocument(
        employee_id=employee_id,
        document_type=document_type_name,
        is_mandatory=is_mandatory,
        file_name=file.filename,
        file_path=file_path,
        status=DocumentStatus.PENDING_REVIEW
    )

    db.add(new_document)
    db.commit()
    db.refresh(new_document)

    return new_document
def get_employee_documents(db: Session, employee_id: int):
    return (
        db.query(EmployeeDocument)
        .filter(EmployeeDocument.employee_id == employee_id)
        .order_by(EmployeeDocument.uploaded_at.desc())
        .all()
    )
def download_employee_document(
    db: Session,
    document_id: UUID,
    employee_id: int
):
    document = (
        db.query(EmployeeDocument)
        .filter(
            EmployeeDocument.id == document_id,
            EmployeeDocument.employee_id == employee_id
        )
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied"
        )

    if not os.path.exists(document.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found on server"
        )

    return FileResponse(
        path=document.file_path,
        filename=document.file_name,
        media_type="application/octet-stream"
    )
