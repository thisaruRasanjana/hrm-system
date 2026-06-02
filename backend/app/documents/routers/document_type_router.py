from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from uuid import UUID

from app.database.database import get_db
from app.documents.schemas.document_type_schema import (
    DocumentTypeCreate,
    DocumentTypeUpdate,
    DocumentTypeResponse,
)
from app.documents.services import document_type_service
from app.auth.dependencies import require_permission

router = APIRouter(prefix="/api/document-types", tags=["Document Types"])


@router.post("/", response_model=DocumentTypeResponse)
def create_document_type(
    data: DocumentTypeCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:approve"))
):
    return document_type_service.create_document_type(db, data)


@router.get("/", response_model=list[DocumentTypeResponse])
def list_all_document_types(
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:view"))
):
    return document_type_service.list_all_document_types(db)


@router.get("/active/", response_model=list[DocumentTypeResponse])
def list_active_document_types(
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:view"))
):
    return document_type_service.list_active_document_types(db)


@router.patch("/{type_id}", response_model=DocumentTypeResponse)
def update_document_type(
    type_id: UUID,
    data: DocumentTypeUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:approve"))
):
    return document_type_service.update_document_type(db, type_id, data)


@router.delete("/{type_id}")
def delete_document_type(
    type_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("document:approve"))
):
    return document_type_service.delete_document_type(db, type_id)
