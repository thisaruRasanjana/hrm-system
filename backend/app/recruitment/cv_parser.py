"""
CV Parser — Extracts candidate name, email, and phone from uploaded PDF/DOCX files.

Uses PyPDF2 for PDF text extraction and python-docx for DOCX.
Falls back gracefully to filename-based name if parsing fails.

Note: This module is a legacy regex-based parser. The primary extraction path
is now the AI screener (ai_service/screener.py); this module is kept as a
fallback for when the AI service is unavailable.
"""

import logging
import os
import re
from typing import Optional

logger = logging.getLogger(__name__)

# Email regex: matches standard email addresses
EMAIL_RE = re.compile(r'[\w.+-]+@[\w-]+\.[\w.-]+')

# Phone regex: matches international and local phone formats
PHONE_RE = re.compile(r'(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}')


def _extract_text_from_pdf(file_path: str) -> str:
    """Extract all text from a PDF file."""
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(file_path)
        text_parts = []
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
        return "\n".join(text_parts)
    except Exception as exc:
        logger.warning("PDF parse error for '%s': %s", file_path, exc)
        return ""


def _extract_text_from_docx(file_path: str) -> str:
    """Extract all text from a DOCX file."""
    try:
        from docx import Document
        doc = Document(file_path)
        return "\n".join(para.text for para in doc.paragraphs if para.text.strip())
    except Exception as exc:
        logger.warning("DOCX parse error for '%s': %s", file_path, exc)
        return ""


def _extract_name(text: str, fallback_filename: str) -> str:
    """
    Heuristic: the candidate's name is usually the first non-empty line
    that contains only letters, spaces, and common name punctuation.
    Falls back to the filename (without extension) if nothing suitable is found.
    """
    name_re = re.compile(r'^[A-Za-z][A-Za-z\s.\'-]{2,40}$')
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
        # Skip lines that look like email, phone, URL, or are too short
        if "@" in line or "http" in line.lower():
            continue
        if name_re.match(line):
            return line
    # Fallback: use the original filename without extension
    return fallback_filename


def _extract_email(text: str) -> Optional[str]:
    """
    Extract the first email address found in the text.
    Returns None (not a placeholder string) when no email is found so callers
    can reliably distinguish 'missing' from 'found'.
    """
    match = EMAIL_RE.search(text)
    return match.group(0) if match else None


def _extract_phone(text: str) -> Optional[str]:
    """
    Extract the first phone number found in the text.
    Returns None when no valid phone number is found — never returns a
    placeholder string, which could be mistaken for real data.
    """
    match = PHONE_RE.search(text)
    if match:
        phone = match.group(0).strip()
        # Require at least 7 digits to filter out false positives.
        digit_count = len(re.sub(r"\D", "", phone))
        if digit_count >= 7:
            return phone
    return None


def parse_cv(file_path: str) -> dict:
    """
    Parse a CV file and extract candidate information.

    Args:
        file_path: Path to the saved CV file (PDF or DOCX).

    Returns:
        dict with keys: full_name, email, phone
    """
    ext = os.path.splitext(file_path)[1].lower()
    filename_base = os.path.splitext(os.path.basename(file_path))[0]

    # Extract text based on file type
    if ext == ".pdf":
        text = _extract_text_from_pdf(file_path)
    elif ext == ".docx":
        text = _extract_text_from_docx(file_path)
    else:
        text = ""

    if not text.strip():
        # No text could be extracted — use the filename as a name fallback;
        # return None for contact fields rather than placeholder strings.
        return {
            "full_name": filename_base,
            "email":     None,
            "phone":     None,
        }

    return {
        "full_name": _extract_name(text, filename_base),
        "email":     _extract_email(text),
        "phone":     _extract_phone(text),
    }
