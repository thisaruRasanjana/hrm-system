from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.documents.models.document_type_model import DocumentType
from app.documents.schemas.document_type_schema import DocumentTypeCreate, DocumentTypeUpdate


def create_document_type(db: Session, data: DocumentTypeCreate) -> DocumentType:
    existing = db.query(DocumentType).filter(DocumentType.name == data.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document type '{data.name}' already exists"
        )
    doc_type = DocumentType(
        name=data.name,
        description=data.description,
        is_mandatory=data.is_mandatory,
        is_active=True,
    )
    db.add(doc_type)
    db.commit()
    db.refresh(doc_type)
    return doc_type


def list_all_document_types(db: Session):
    return db.query(DocumentType).order_by(DocumentType.created_at.desc()).all()


def list_active_document_types(db: Session):
    return db.query(DocumentType).filter(DocumentType.is_active == True).order_by(DocumentType.created_at.desc()).all()


def update_document_type(db: Session, type_id: int, data: DocumentTypeUpdate) -> DocumentType:
    doc_type = db.query(DocumentType).filter(DocumentType.id == type_id).first()
    if not doc_type:
        raise HTTPException(status_code=404, detail="Document type not found")

    if data.name is not None:
        # Check for name conflict with other types
        conflict = db.query(DocumentType).filter(
            DocumentType.name == data.name,
            DocumentType.id != type_id
        ).first()
        if conflict:
            raise HTTPException(status_code=400, detail=f"Name '{data.name}' is already in use")
        doc_type.name = data.name

    if data.description is not None:
        doc_type.description = data.description
    if data.is_mandatory is not None:
        doc_type.is_mandatory = data.is_mandatory
    if data.is_active is not None:
        doc_type.is_active = data.is_active

    db.commit()
    db.refresh(doc_type)
    return doc_type


def delete_document_type(db: Session, type_id: int):
    doc_type = db.query(DocumentType).filter(DocumentType.id == type_id).first()
    if not doc_type:
        raise HTTPException(status_code=404, detail="Document type not found")
    db.delete(doc_type)
    db.commit()
    return {"detail": "Document type deleted"}
