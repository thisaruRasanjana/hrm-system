"""
tests/test_document_type_service.py
===================================
Unit tests for the document type service.
"""

import pytest
from fastapi import HTTPException

from app.documents.schemas.document_type_schema import DocumentTypeCreate, DocumentTypeUpdate
from app.documents.services import document_type_service


def test_create_document_type_success(db):
    data = DocumentTypeCreate(name="Passport", description="Travel doc", is_mandatory=True)
    doc_type = document_type_service.create_document_type(db, data)
    
    assert doc_type.id is not None
    assert doc_type.name == "Passport"
    assert doc_type.is_mandatory is True
    assert doc_type.is_active is True


def test_create_document_type_duplicate(db):
    data = DocumentTypeCreate(name="CV")
    document_type_service.create_document_type(db, data)
    
    # Attempting to create another type with the same name should raise 400
    with pytest.raises(HTTPException) as excinfo:
        document_type_service.create_document_type(db, data)
        
    assert excinfo.value.status_code == 400
    assert "already exists" in excinfo.value.detail


def test_list_document_types(db):
    document_type_service.create_document_type(db, DocumentTypeCreate(name="Doc 1"))
    
    doc2 = document_type_service.create_document_type(db, DocumentTypeCreate(name="Doc 2"))
    # Soft delete doc2
    document_type_service.update_document_type(db, doc2.id, DocumentTypeUpdate(is_active=False))
    
    all_types = document_type_service.list_all_document_types(db)
    active_types = document_type_service.list_active_document_types(db)
    
    assert len(all_types) == 2
    assert len(active_types) == 1
    assert active_types[0].name == "Doc 1"


def test_delete_document_type(db):
    doc = document_type_service.create_document_type(db, DocumentTypeCreate(name="To Delete"))
    document_type_service.delete_document_type(db, doc.id)
    
    all_types = document_type_service.list_all_document_types(db)
    assert len(all_types) == 0
