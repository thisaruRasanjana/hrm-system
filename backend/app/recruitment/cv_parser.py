"""
CV Parser — Extracts candidate name, email, and phone from uploaded PDF/DOCX files.

Uses PyPDF2 for PDF text extraction and python-docx for DOCX.
Falls back gracefully to filename-based name if parsing fails.
"""

import re
import os

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
    except Exception as e:
        print(f"PDF parse error for {file_path}: {e}")
        return ""


def _extract_text_from_docx(file_path: str) -> str:
    """Extract all text from a DOCX file."""
    try:
        from docx import Document
        doc = Document(file_path)
        return "\n".join(para.text for para in doc.paragraphs if para.text.strip())
    except Exception as e:
        print(f"DOCX parse error for {file_path}: {e}")
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


def _extract_email(text: str) -> str:
    """Extract the first email address found in the text."""
    match = EMAIL_RE.search(text)
    return match.group(0) if match else "placeholder@email.com"


def _extract_phone(text: str) -> str:
    """Extract the first phone number found in the text."""
    match = PHONE_RE.search(text)
    if match:
        phone = match.group(0).strip()
        # Only return if it looks like a real phone (at least 7 digits)
        digits = re.sub(r'\D', '', phone)
        if len(digits) >= 7:
            return phone
    return "0000000000"


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
        # No text extracted — use filename as fallback
        return {
            "full_name": filename_base,
            "email": "placeholder@email.com",
            "phone": "0000000000",
        }

    return {
        "full_name": _extract_name(text, filename_base),
        "email": _extract_email(text),
        "phone": _extract_phone(text),
    }
