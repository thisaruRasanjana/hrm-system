"""
documents/routers/template_router.py
====================================
Router for document template management.
"""

from typing import List

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.documents.schemas.template_schema import TemplateResponse
from app.documents.services import template_service
from app.core.deps import get_current_user, require_permission

router = APIRouter(
    prefix="/document-templates",
    tags=["Document Templates"]
)


@router.post("/", response_model=TemplateResponse)
def create_template(
    name: str = Form(...),
    category: str = Form(...),
    template_type: str = Form(...),
    content: str = Form(None),
    file: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:template_upload"))
):
    return template_service.create_template(db, name, category, template_type, content, file)


@router.get("/", response_model=List[TemplateResponse])
def get_templates(
    category: str = None,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:template_upload"))
):
    return template_service.get_all_templates(db, category=category)


@router.get("/{template_id}", response_model=TemplateResponse)
def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:template_upload"))
):
    template = template_service.get_template(db, template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return template


@router.put("/{template_id}", response_model=TemplateResponse)
def update_template(
    template_id: int,
    name: str = Form(None),
    category: str = Form(None),
    template_type: str = Form(None),
    content: str = Form(None),
    file: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:template_upload"))
):
    template = template_service.update_template(db, template_id, name, category, template_type, content, file)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return template


@router.delete("/{template_id}")
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:template_upload"))
):
    template = template_service.delete_template(db, template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return {"message": "Template deleted successfully"}


@router.get("/{template_id}/preview")
def preview_docx_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:template_upload"))
):
    """Generate an HTML preview of a DOCX template."""
    template = template_service.get_template(db, template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    try:
        html_preview = template_service.generate_docx_preview(template)
        return {"preview_html": html_preview}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))