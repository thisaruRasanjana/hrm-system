"""
app/core/storage.py
===================
CV file upload handler for the Recruitment module.

Delegates all actual I/O to the unified StorageService.
Returns a storage key (not an absolute local path) that is stored in
candidate.cv_file_path in the database.

To migrate to S3: set STORAGE_BACKEND=s3 in backend/.env — no code change needed.
"""

import os
from uuid import uuid4

from fastapi import HTTPException, UploadFile

from app.core.storage_service import storage

# Maximum permitted file size in bytes (5 MB).
MAX_FILE_SIZE_BYTES: int = 5 * 1024 * 1024

# Permitted CV file extensions.
ALLOWED_EXTENSIONS: frozenset[str] = frozenset({".pdf", ".docx"})


def save_file_locally(file: UploadFile) -> str:
    """
    Validate and persist an uploaded CV file using the active storage backend.

    Raises:
        HTTPException 400: unsupported file extension.
        HTTPException 413: file exceeds MAX_FILE_SIZE_BYTES.
        HTTPException 500: any storage write failure.

    Returns:
        Storage key for the saved file (e.g. "cvs/abc123.pdf").
        Store this key in the database — use storage.get_url(key) to get
        a URL, and storage.abs_path(key) to get a local path for AI processing.
    """
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Only PDF and DOCX are accepted.",
        )

    content = file.file.read()
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB size limit.",
        )

    unique_filename = f"{uuid4()}{ext}"
    key = f"cvs/{unique_filename}"

    try:
        storage.upload(content, key)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to save uploaded file. Please try again.",
        ) from exc

    return key