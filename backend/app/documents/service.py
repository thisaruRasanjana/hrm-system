import os
from uuid import UUID
from fastapi import UploadFile, HTTPException, status
from sqlalchemy.orm import Session

from app.documents.model import EmployeeDocument, DocumentStatus
BASE_UPLOAD_DIR = "uploads/documents"

ALLOWED_FILE_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png"
]
def save_file(file: UploadFile, employee_id: UUID) -> str:
    os.makedirs(BASE_UPLOAD_DIR, exist_ok=True)

    file_path = os.path.join(
        BASE_UPLOAD_DIR,
        f"{employee_id}_{file.filename}"
    )

    with open(file_path, "wb") as buffer:
        buffer.write(file.file.read())

    return file_path
def upload_employee_document(
    db: Session,
    employee_id: UUID,
    document_type: str,
    is_mandatory: bool,
    file: UploadFile
):
    # ✅ File type validation
    if file.content_type not in ALLOWED_FILE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF, JPG, and PNG files are allowed"
        )

    # ✅ Save file to uploads/documents/
    file_path = save_file(file, employee_id)

    # ✅ Create DB record with clean status
    document = EmployeeDocument(
        employee_id=employee_id,
        document_type=document_type,
        is_mandatory=is_mandatory,
        file_name=file.filename,
        file_path=file_path,
        status=DocumentStatus.PENDING_REVIEW
    )

    db.add(document)
    db.commit()
    db.refresh(document)

    return document
def get_employee_documents(db: Session, employee_id: UUID):
    return (
        db.query(EmployeeDocument)
        .filter(EmployeeDocument.employee_id == employee_id)
        .order_by(EmployeeDocument.uploaded_at.desc())
        .all()
    )
