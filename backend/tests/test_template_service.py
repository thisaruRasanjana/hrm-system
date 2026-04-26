"""
tests/test_template_service.py
==============================
Unit tests for the template service.
"""

from app.documents.services.template_service import _detect_type_from_file

def test_detect_type_from_file():
    # Should detect based on extension
    assert _detect_type_from_file("template.docx", "HTML") == "DOCX"
    assert _detect_type_from_file("letter.PDF", "DOCX") == "PDF"
    
    # Should fallback if unknown or missing extension
    assert _detect_type_from_file("template.txt", "HTML") == "HTML"
    assert _detect_type_from_file("template", "DOCX") == "DOCX"
    assert _detect_type_from_file(None, "HTML") == "HTML"
