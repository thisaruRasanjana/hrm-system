import os
from uuid import uuid4
from fastapi import UploadFile
from app.core.config import UPLOAD_DIR


def save_file_locally(file: UploadFile) -> str:
    """
    Saves an uploaded file to local storage and returns the ABSOLUTE file path.

    Returns an absolute path so that the AI service (which runs from a different
    working directory) can open the file without ambiguity.

    Swap this function for a boto3 upload when migrating to S3.
    """
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    extension = file.filename.rsplit(".", 1)[-1]
    unique_filename = f"{uuid4()}.{extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    with open(file_path, "wb") as buffer:
        buffer.write(file.file.read())

    # Return absolute path — critical for cross-service file access
    return os.path.abspath(file_path)