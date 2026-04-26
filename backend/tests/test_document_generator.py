"""
tests/test_document_generator.py
================================
Unit tests for the context builder and text replacement functions
in the document generator.
"""

import uuid
from app.documents.services.document_generator import (
    _build_context,
    _build_external_context,
    _replace_placeholders
)


class DummyEmployee:
    def __init__(self):
        self.id = 99
        self.first_name = "John"
        self.last_name = "Doe"
        self.designation = "Software Engineer"
        self.department = "IT"


class DummyRequest:
    def __init__(self, external=False):
        self.id = uuid.uuid4()
        self.document_type = "Service Letter"
        self.reason = "Bank loan"
        self.requester_email = "jane.doe@example.com" if external else None


def test_build_context():
    emp = DummyEmployee()
    req = DummyRequest()
    
    ctx = _build_context(emp, req)
    
    assert ctx["employee_name"] == "John Doe"
    assert ctx["employee_id"] == "99"
    assert ctx["designation"] == "Software Engineer"
    assert ctx["department"] == "IT"
    assert ctx["reason"] == "Bank loan"
    assert ctx["document_type"] == "Service Letter"
    assert "date" in ctx


def test_build_context_with_override():
    emp = DummyEmployee()
    req = DummyRequest()
    
    ctx = _build_context(emp, req, override_reason="Custom reason")
    assert ctx["reason"] == "Custom reason"


def test_build_external_context():
    req = DummyRequest(external=True)
    
    ctx = _build_external_context(req)
    
    # Should derive name from jane.doe@example.com
    assert ctx["employee_name"] == "Jane Doe"
    assert ctx["employee_id"] == ""
    assert ctx["designation"] == ""
    assert ctx["department"] == ""
    assert ctx["requester_email"] == "jane.doe@example.com"


def test_replace_placeholders():
    template_text = "This letter is to confirm that {{employee_name}} works in the {{department}} department."
    context = {"employee_name": "Jane Smith", "department": "HR"}
    
    result = _replace_placeholders(template_text, context)
    assert result == "This letter is to confirm that Jane Smith works in the HR department."
