from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database.database import get_db
from app.documents.schemas.template_schema import TemplateResponse
from app.documents.services import template_service

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
    db: Session = Depends(get_db)
):

    template = template_service.create_template(
        db,
        name,
        category,
        template_type,
        content,
        file
    )

    return template


@router.get("/", response_model=List[TemplateResponse])
def get_templates(db: Session = Depends(get_db)):
    return template_service.get_all_templates(db)


@router.get("/{template_id}", response_model=TemplateResponse)
def get_template(template_id: int, db: Session = Depends(get_db)):

    template = template_service.get_template(db, template_id)

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    return template


@router.put("/{template_id}", response_model=TemplateResponse)
def update_template(
    template_id: int,
    name: str = Form(None),
    category: str = Form(None),
    template_type: str = Form(None),
    content: str = Form(None),
    file: UploadFile = File(None),
    db: Session = Depends(get_db)
):

    template = template_service.update_template(
        db,
        template_id,
        name,
        category,
        template_type,
        content,
        file
    )

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    return template


@router.delete("/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db)):

    template = template_service.delete_template(db, template_id)

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    return {"message": "Template deleted successfully"}


@router.get("/{template_id}/preview")
def preview_docx_template(template_id: int, db: Session = Depends(get_db)):
    template = template_service.get_template(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    if template.template_type != "DOCX" or not template.file_path:
        raise HTTPException(status_code=400, detail="Only DOCX templates can be previewed this way")

    import os
    if not os.path.exists(template.file_path):
        raise HTTPException(status_code=404, detail="Template file not found on disk")

    try:
        import mammoth
        with open(template.file_path, "rb") as docx_file:
            result = mammoth.convert_to_html(docx_file)
            html_preview = result.value

        return {"preview_html": html_preview}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate preview: {str(e)}")