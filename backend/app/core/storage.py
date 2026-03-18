import os
from uuid import uuid4
from fastapi import UploadFile

UPLOAD_DIR = "uploads/cvs"


def save_file_locally(file: UploadFile) -> str:
    """
    Saves uploaded file locally and returns stored file path.
    Designed so it can be replaced with S3 later.
    """

    # Ensure upload directory exists
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # Generate unique filename
    file_extension = file.filename.split(".")[-1]
    unique_filename = f"{uuid4()}.{file_extension}"

    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    with open(file_path, "wb") as buffer:
        buffer.write(file.file.read())

    return file_path