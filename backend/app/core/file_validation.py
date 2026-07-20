"""
core/file_validation.py
=======================
Central, dependency-free upload validation.

Client-supplied `Content-Type` headers and file extensions are trivially
spoofable, so uploads are validated by sniffing the leading *magic bytes* of the
file content. This is what stops an attacker renaming ``malicious.exe`` →
``avatar.png`` (or embedding JavaScript in an ``.html`` / ``.svg`` and having it
served inline as active content — a stored-XSS vector).

Kept pure-Python on purpose: no libmagic / python-magic dependency, so it works
identically on Windows, Linux and CI.
"""

from typing import Optional

from fastapi import HTTPException, UploadFile, status

# ── Canonical MIME types we accept anywhere in the app ────────────────────────
PDF = "application/pdf"
JPEG = "image/jpeg"
PNG = "image/png"
WEBP = "image/webp"
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

# Common allow-lists, re-used by callers.
IMAGE_TYPES = (JPEG, PNG, WEBP)
TEMPLATE_TYPES = (DOCX, PDF)

# Extension normalized from the *detected* type — never trust the client's.
_EXT = {
    PDF: ".pdf",
    JPEG: ".jpg",
    PNG: ".png",
    WEBP: ".webp",
    DOCX: ".docx",
}

# Magic-byte prefixes per type. DOCX (and every OOXML file) is a ZIP container,
# so it shares the ``PK`` signature — good enough to reject executables/scripts,
# which is the actual threat here.
_SIGNATURES = {
    PDF: (b"%PDF-",),
    JPEG: (b"\xff\xd8\xff",),
    PNG: (b"\x89PNG\r\n\x1a\n",),
    DOCX: (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
}


def detect_content_type(head: bytes) -> Optional[str]:
    """Return the canonical MIME type sniffed from a file's leading bytes.

    Returns None when the content matches none of the known-good signatures.
    """
    # WEBP is a RIFF container: "RIFF" .... "WEBP".
    if len(head) >= 12 and head[0:4] == b"RIFF" and head[8:12] == b"WEBP":
        return WEBP
    for mime, sigs in _SIGNATURES.items():
        if any(head.startswith(sig) for sig in sigs):
            return mime
    return None


def validate_upload(
    file: UploadFile,
    allowed_types: tuple[str, ...],
    *,
    max_size_bytes: Optional[int] = None,
    reject_message: str = "File type not allowed",
) -> tuple[bytes, str, str]:
    """Validate an uploaded file by content and return its bytes.

    Reads the whole file into memory once (uploads here are small — images and
    templates), then enforces, in order:

    1. Not empty (zero-byte uploads are rejected — ``400 File is empty``).
    2. Within ``max_size_bytes`` if given.
    3. Its sniffed magic-byte type is in ``allowed_types``.

    Returns ``(content, detected_mime, normalized_ext)``. The normalized
    extension is derived from the *detected* type, so the stored filename never
    inherits a spoofed client extension.

    Raises:
        HTTPException 400: empty file, too large, or disallowed/undetectable type.
    """
    content = file.file.read()
    # Reset so any later re-read (or a fallback path) still sees the full file.
    try:
        file.file.seek(0)
    except Exception:
        pass

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is empty",
        )

    if max_size_bytes is not None and len(content) > max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum allowed size of {max_size_bytes // (1024 * 1024)}MB",
        )

    detected = detect_content_type(content[:32])
    if detected not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=reject_message,
        )

    return content, detected, _EXT[detected]
