"""
Core — Local File Storage

Saves uploaded CV files to a UUID-named path on disk.
Returns the absolute path so the AI service can locate the file
regardless of its working directory.

To migrate to S3: replace save_file_locally() with a boto3 upload
and return a pre-signed URL — the rest of the codebase is unchanged.
"""

import os
from uuid import uuid4

from fastapi import HTTPException, UploadFile

from app.core.config import UPLOAD_DIR

# Maximum permitted file size in bytes (5 MB).
# Defined as a constant so it can be updated in one place.
MAX_FILE_SIZE_BYTES: int = 5 * 1024 * 1024

# Permitted CV file extensions.
ALLOWED_EXTENSIONS: frozenset[str] = frozenset({".pdf", ".docx"})


def save_file_locally(file: UploadFile) -> str:
    """
    Validate and persist an uploaded file to local disk.

    Raises:
        HTTPException 400: unsupported file extension.
        HTTPException 413: file exceeds MAX_FILE_SIZE_BYTES.
        HTTPException 500: any OS-level write failure.

    Returns:
        Absolute path to the saved file.
    """
    # Validate extension — use the original filename, not a user-supplied MIME type.
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Only PDF and DOCX are accepted.",
        )

    # Read content once; check size before writing to disk.
    content = file.file.read()
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB size limit.",
        )

    # Always resolve UPLOAD_DIR to an absolute path anchored to the backend root
    # so the path stored in the DB is always valid regardless of working directory.
    _this_dir = os.path.dirname(os.path.abspath(__file__))   # .../backend/app/core
    _backend_root = os.path.dirname(os.path.dirname(_this_dir))  # .../backend
    upload_abs = (
        UPLOAD_DIR if os.path.isabs(UPLOAD_DIR)
        else os.path.abspath(os.path.join(_backend_root, UPLOAD_DIR))
    )

    unique_filename = f"{uuid4()}{ext}"
    file_path = os.path.join(upload_abs, unique_filename)

    try:
        os.makedirs(upload_abs, exist_ok=True)
        with open(file_path, "wb") as buffer:
            buffer.write(content)
    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to save uploaded file. Please try again.",
        ) from exc

    # Return absolute path — critical for cross-service file access.
    return os.path.abspath(file_path)