"""
documents/services/document_type_service.py
===========================================
Service layer for managing document type catalogues.

Responsibilities:
- Creating, reading, updating, and soft-deleting document types.
- Enforcing uniqueness of document type names.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.documents.models.document_type_model import DocumentType
from app.documents.schemas.document_type_schema import DocumentTypeCreate, DocumentTypeUpdate


def create_document_type(db: Session, data: DocumentTypeCreate) -> DocumentType:
    """Create a new document type entry.

    Ensures the name is unique before saving.

    Args:
        db: Active database session.
        data: Validated DocumentTypeCreate input payload.

    Returns:
        The created DocumentType ORM object.

    Raises:
        HTTPException 400: If the name already exists.
        HTTPException 500: If the database commit fails.
    """
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

    try:
        db.add(doc_type)
        db.commit()
        db.refresh(doc_type)
        return doc_type
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create document type."
        ) from exc


def list_all_document_types(db: Session) -> list[DocumentType]:
    """Retrieve all document types (active and inactive) for HR admins.

    Args:
        db: Active database session.

    Returns:
        List of DocumentType ORM objects ordered by creation date descending.
    """
    return db.query(DocumentType).order_by(DocumentType.created_at.desc()).all()


def list_active_document_types(db: Session) -> list[DocumentType]:
    """Retrieve only active document types (for employee-facing dropdowns).

    Args:
        db: Active database session.

    Returns:
        List of DocumentType ORM objects ordered by creation date descending.
    """
    return (
        db.query(DocumentType)
        .filter(DocumentType.is_active == True)
        .order_by(DocumentType.created_at.desc())
        .all()
    )


def update_document_type(db: Session, type_id: UUID, data: DocumentTypeUpdate) -> DocumentType:
    """Update an existing document type.

    Enforces name uniqueness across other existing records.

    Args:
        db: Active database session.
        type_id: UUID of the document type to update.
        data: Validated DocumentTypeUpdate input payload.

    Returns:
        The updated DocumentType ORM object.

    Raises:
        HTTPException 404: If the document type doesn't exist.
        HTTPException 400: If the new name conflicts with an existing record.
        HTTPException 500: If the database commit fails.
    """
    doc_type = db.query(DocumentType).filter(DocumentType.id == type_id).first()
    if not doc_type:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document type not found")

    if data.name is not None:
        conflict = db.query(DocumentType).filter(
            DocumentType.name == data.name,
            DocumentType.id != type_id
        ).first()
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Name '{data.name}' is already in use"
            )
        doc_type.name = data.name

    if data.description is not None:
        doc_type.description = data.description
    if data.is_mandatory is not None:
        doc_type.is_mandatory = data.is_mandatory
    if data.is_active is not None:
        doc_type.is_active = data.is_active

    try:
        db.commit()
        db.refresh(doc_type)
        return doc_type
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update document type."
        ) from exc


def delete_document_type(db: Session, type_id: UUID) -> dict:
    """Hard-delete a document type.

    (Note: Prefer soft-delete via is_active=False if records already reference this type).

    Args:
        db: Active database session.
        type_id: UUID of the document type to delete.

    Returns:
        A dictionary with a success message.

    Raises:
        HTTPException 404: If the document type doesn't exist.
        HTTPException 500: If the database commit fails.
    """
    doc_type = db.query(DocumentType).filter(DocumentType.id == type_id).first()
    if not doc_type:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document type not found")

    try:
        db.delete(doc_type)
        db.commit()
        return {"detail": "Document type deleted"}
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete document type."
        ) from exc
