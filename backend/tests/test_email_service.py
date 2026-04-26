"""
tests/test_email_service.py
===========================
Unit tests for the pure heuristic functions in email_service.py.
We test these functions without needing a real IMAP connection.
"""

from app.documents.services.email_service import (
    _is_document_request,
    _infer_document_type,
    _decode_str
)


def test_is_document_request():
    # True positives
    assert _is_document_request("Need a service letter", "Please provide a letter of employment.") is True
    assert _is_document_request("Payslip request", "Can I get my payslip for March?") is True
    assert _is_document_request("Schengen application", "I need an embassy letter for my visa.") is True
    assert _is_document_request("Document request", "Please issue a letter for bank.") is True

    # True negatives
    assert _is_document_request("Lunch today", "Are we still meeting at 12?") is False
    assert _is_document_request("Project update", "The deployment was successful.") is False


def test_infer_document_type():
    assert _infer_document_type("Urgent: Service Letter", "I need proof of employment") == "Service Letter"
    assert _infer_document_type("March Salary", "Where is my payslip?") == "Payslip"
    assert _infer_document_type("Visa application", "Going to France") == "Visa Letter"
    
    # Fallback
    assert _infer_document_type("Issue a letter", "I need a document for the bank") == "Custom Document Request"


def test_decode_str():
    # Plain text
    assert _decode_str("Hello World") == "Hello World"
    # Null cases
    assert _decode_str(None) == ""
    assert _decode_str("") == ""
