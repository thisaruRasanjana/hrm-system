from sqlalchemy.orm import Session
from fastapi import UploadFile
from ..models.template_model import DocumentTemplate
import shutil
import os
from datetime import datetime

UPLOAD_DIR = "uploads/templates"


def _detect_type_from_file(filename: str, fallback: str) -> str:
    """Detect template_type from file extension. Falls back to provided value."""
    if not filename:
        return fallback
    ext = os.path.splitext(filename)[1].lower()
    if ext == ".docx":
        return "DOCX"
    elif ext == ".pdf":
        return "PDF"
    return fallback


def create_template(
    db: Session,
    name: str,
    category: str,
    template_type: str,
    content: str = None,
    file: UploadFile = None,
):
    file_path = None

    if file and file.filename:
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        # Auto-detect correct type from the actual uploaded file extension
        template_type = _detect_type_from_file(file.filename, template_type)
        file_location = f"{UPLOAD_DIR}/{file.filename}"

        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_path = file_location

    template = DocumentTemplate(
        name=name,
        category=category,
        template_type=template_type,
        content=content,
        file_path=file_path,
        created_at=datetime.utcnow(),
    )

    db.add(template)
    db.commit()
    db.refresh(template)

    return template



def get_all_templates(db: Session, category: str = None):
    query = db.query(DocumentTemplate).order_by(DocumentTemplate.created_at.desc())
    if category:
        # Case-insensitive contains match so "Service Letter" matches "Service Letter"
        query = query.filter(DocumentTemplate.category.ilike(f"%{category}%"))
    return query.all()


def get_template(db: Session, template_id: int):
    return db.query(DocumentTemplate).filter(DocumentTemplate.id == template_id).first()


def update_template(
    db: Session,
    template_id: int,
    name: str = None,
    category: str = None,
    template_type: str = None,
    content: str = None,
    file: UploadFile = None,
):

    template = db.query(DocumentTemplate).filter(DocumentTemplate.id == template_id).first()

    if not template:
        return None

    if name:
        template.name = name

    if category:
        template.category = category

    if template_type:
        template.template_type = template_type

    if content:
        template.content = content

    if file and file.filename:
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        # Auto-detect type from the uploaded file
        template.template_type = _detect_type_from_file(file.filename, template.template_type)
        file_location = f"{UPLOAD_DIR}/{file.filename}"

        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        template.file_path = file_location

    template.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(template)

    return template


def delete_template(db: Session, template_id: int):

    template = db.query(DocumentTemplate).filter(DocumentTemplate.id == template_id).first()

    if not template:
        return None

    db.delete(template)
    db.commit()

    return template