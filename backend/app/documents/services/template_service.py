"""
documents/services/template_service.py
======================================
Service layer for managing document templates.

Responsibilities:
- Uploading and saving template files (DOCX, PDF) or HTML strings.
- Auto-detecting template types from file extensions.
- Providing DOCX preview conversion using mammoth.
"""

import os
import shutil
from datetime import datetime
from uuid import uuid4

from fastapi import HTTPException, status, UploadFile
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.documents.models.template_model import DocumentTemplate
from app.documents.constants import UPLOAD_DIR_TEMPLATES


def _detect_type_from_file(filename: str, fallback: str) -> str:
    """Detect template format from file extension.

    Args:
        filename: Name of the uploaded file.
        fallback: Type to return if no clear match is found.

    Returns:
        The detected TemplateTypeEnum string (e.g., 'DOCX', 'PDF').
    """
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
) -> DocumentTemplate:
    """Create a new document template.

    Saves the file to disk if provided, otherwise relies on the HTML content string.

    Args:
        db: Active database session.
        name: Name of the template.
        category: Category of the template.
        template_type: Declared type (HTML/DOCX/PDF).
        content: HTML content string (only used if type is HTML).
        file: Uploaded file (used for DOCX/PDF).

    Returns:
        The created DocumentTemplate ORM object.

    Raises:
        HTTPException 500: If the database commit fails.
    """
    file_path = None

    if file and file.filename:
        os.makedirs(UPLOAD_DIR_TEMPLATES, exist_ok=True)
        # Auto-detect correct type from the actual uploaded file extension
        template_type = _detect_type_from_file(file.filename, template_type)
        # Store under a server-generated unique name (never the user filename) to
        # avoid path traversal and overwriting another template with the same name.
        ext = os.path.splitext(file.filename or "")[1].lower()
        file_location = os.path.join(UPLOAD_DIR_TEMPLATES, f"{uuid4().hex}{ext}")

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

    try:
        db.add(template)
        db.commit()
        db.refresh(template)
        return template
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create template. Please try again."
        ) from exc


def get_all_templates(db: Session, category: str = None) -> list[DocumentTemplate]:
    """Retrieve all document templates, optionally filtered by category.

    Args:
        db: Active database session.
        category: Case-insensitive substring match for category.

    Returns:
        List of DocumentTemplate ORM objects.
    """
    query = db.query(DocumentTemplate).order_by(DocumentTemplate.created_at.desc())
    if category:
        query = query.filter(DocumentTemplate.category.ilike(f"%{category}%"))
    return query.all()


def get_template(db: Session, template_id: int) -> DocumentTemplate:
    """Retrieve a single document template by ID.

    Args:
        db: Active database session.
        template_id: Integer ID of the template.

    Returns:
        The DocumentTemplate ORM object, or None if not found.
    """
    return db.query(DocumentTemplate).filter(DocumentTemplate.id == template_id).first()


def update_template(
    db: Session,
    template_id: int,
    name: str = None,
    category: str = None,
    template_type: str = None,
    content: str = None,
    file: UploadFile = None,
) -> DocumentTemplate:
    """Update an existing document template.

    Only applies provided fields. If a new file is provided, the old file path
    is overwritten in the database (but old file is not deleted from disk yet).

    Args:
        db: Active database session.
        template_id: Integer ID of the template.
        name: New name.
        category: New category.
        template_type: New type.
        content: New HTML content.
        file: New uploaded file.

    Returns:
        The updated DocumentTemplate ORM object, or None if not found.

    Raises:
        HTTPException 500: If the database commit fails.
    """
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
        os.makedirs(UPLOAD_DIR_TEMPLATES, exist_ok=True)
        template.template_type = _detect_type_from_file(file.filename, template.template_type)
        # Server-generated unique name (see create_template) — no traversal/collision.
        ext = os.path.splitext(file.filename or "")[1].lower()
        file_location = os.path.join(UPLOAD_DIR_TEMPLATES, f"{uuid4().hex}{ext}")

        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        template.file_path = file_location

    template.updated_at = datetime.utcnow()

    try:
        db.commit()
        db.refresh(template)
        return template
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update template. Please try again."
        ) from exc


def delete_template(db: Session, template_id: int) -> DocumentTemplate:
    """Delete a document template.

    Note: Does not delete the physical file from disk.

    Args:
        db: Active database session.
        template_id: Integer ID of the template.

    Returns:
        The deleted DocumentTemplate ORM object, or None if not found.

    Raises:
        HTTPException 500: If the database commit fails.
    """
    template = db.query(DocumentTemplate).filter(DocumentTemplate.id == template_id).first()

    if not template:
        return None

    try:
        db.delete(template)
        db.commit()
        return template
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete template. Please try again."
        ) from exc


def generate_docx_preview(template: DocumentTemplate) -> str:
    """Generate an HTML preview of a DOCX template using mammoth.

    Args:
        template: The DocumentTemplate ORM object.

    Returns:
        An HTML string representing the parsed DOCX content.

    Raises:
        ValueError: If the file doesn't exist or conversion fails.
    """
    if template.template_type != "DOCX" or not template.file_path:
        raise ValueError("Only DOCX templates can be previewed this way.")

    if not os.path.exists(template.file_path):
        raise ValueError("Template file not found on disk.")

    try:
        import mammoth
        with open(template.file_path, "rb") as docx_file:
            result = mammoth.convert_to_html(docx_file)
            return result.value
    except Exception as exc:
        raise ValueError(f"Failed to generate DOCX preview: {exc}")