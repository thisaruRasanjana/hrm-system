from sqlalchemy.orm import Session
from fastapi import UploadFile
from ..models.template_model import DocumentTemplate
import shutil
import os
from datetime import datetime

UPLOAD_DIR = "uploads/templates"


def create_template(
    db: Session,
    name: str,
    category: str,
    template_type: str,
    content: str = None,
    file: UploadFile = None,
):
    file_path = None

    if file:
        os.makedirs(UPLOAD_DIR, exist_ok=True)

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


def get_all_templates(db: Session):
    return db.query(DocumentTemplate).order_by(DocumentTemplate.created_at.desc()).all()


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

    if file:
        os.makedirs(UPLOAD_DIR, exist_ok=True)

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