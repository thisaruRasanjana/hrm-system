"""
app/core/storage_service.py
============================
Unified file storage abstraction.

SWITCHING BACKENDS
------------------
In backend/.env, set:

    STORAGE_BACKEND=local   ← filesystem (default, no AWS needed)
    STORAGE_BACKEND=s3      ← AWS S3 or any S3-compatible store (MinIO, etc.)

For S3 mode also set:
    AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
    AWS_S3_ENDPOINT_URL   (leave blank for real AWS; set to http://localhost:9000 for MinIO)

PUBLIC API
----------
Import the singleton:

    from app.core.storage_service import storage

Then call:

    key      = storage.upload(file_data: bytes, key: str) -> str
    url      = storage.get_url(key: str) -> str
    data     = storage.download(key: str) -> bytes
    exists   = storage.file_exists(key: str) -> bool
             storage.delete(key: str) -> None
    response = storage.serve(key: str, filename: str) -> Response

Where `key` is always a forward-slash path relative to the bucket/upload root,
e.g. "documents/abc123.pdf" or "profiles/42.jpg".
"""

import io
import os
import tempfile
from typing import Optional

from fastapi import HTTPException
from fastapi.responses import FileResponse, RedirectResponse, Response

from app.core.config import (
    STORAGE_BACKEND,
    AWS_S3_BUCKET,
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_REGION,
    AWS_S3_ENDPOINT_URL,
)


# ---------------------------------------------------------------------------
# Key normalization
# ---------------------------------------------------------------------------

def _normalize_key(key: str) -> str:
    """Normalize a storage key to a canonical, forward-slash path relative to the
    upload root (e.g. "documents/x.pdf", "generated_documents/y.pdf").

    Tolerates legacy/pre-refactor values that stored the full path with the
    "uploads/" root prefix and/or Windows backslashes
    (e.g. "uploads/documents\\28_x.pdf"). Without this, get_url() would emit a
    doubled "/uploads/uploads/..." path and every legacy file would 404.
    """
    if not key:
        return key
    k = key.replace("\\", "/").lstrip("/")
    # Drop a single redundant leading "uploads/" segment (the local root).
    if k.lower().startswith("uploads/"):
        k = k[len("uploads/"):]
    return k


# ---------------------------------------------------------------------------
# Local Filesystem Backend
# ---------------------------------------------------------------------------

class _LocalStorageBackend:
    """Stores files on the local filesystem under backend/uploads/."""

    def __init__(self):
        # Resolve the absolute path to the backend root directory so that
        # storage works regardless of the working directory uvicorn is started from.
        _this_file = os.path.abspath(__file__)              # .../app/core/storage_service.py
        _app_dir   = os.path.dirname(os.path.dirname(_this_file))  # .../app
        _backend_dir = os.path.dirname(_app_dir)           # .../backend
        self._root = os.path.join(_backend_dir, "uploads")

    def _abs(self, key: str) -> str:
        """Convert a storage key to an absolute local path, confined to the root.

        Normalizes legacy "uploads/"-prefixed / backslash keys, then verifies the
        resolved path stays inside the upload root so a crafted key containing
        ".." can never read or write outside it (path-traversal defense).
        """
        safe = os.path.normpath(_normalize_key(key)).lstrip("/").lstrip("\\")
        abs_path = os.path.join(self._root, safe)
        real_root = os.path.realpath(self._root)
        real_path = os.path.realpath(abs_path)
        if real_path != real_root and not real_path.startswith(real_root + os.sep):
            raise HTTPException(status_code=400, detail="Invalid file path.")
        return abs_path

    def upload(self, file_data: bytes, key: str) -> str:
        """Write bytes to disk. Creates parent dirs as needed. Returns the key."""
        abs_path = self._abs(key)
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        with open(abs_path, "wb") as f:
            f.write(file_data)
        return key

    def get_url(self, key: str) -> str:
        """Return the public URL for a stored file (via the /uploads static mount)."""
        # Normalize (handles legacy "uploads/"-prefixed and backslash keys).
        return f"/uploads/{_normalize_key(key)}"

    def download(self, key: str) -> bytes:
        """Read and return file bytes from disk."""
        abs_path = self._abs(key)
        if not os.path.exists(abs_path):
            raise FileNotFoundError(f"File not found: {key}")
        with open(abs_path, "rb") as f:
            return f.read()

    def file_exists(self, key: str) -> bool:
        return os.path.exists(self._abs(key))

    def delete(self, key: str) -> None:
        """Delete a file. Silently ignores if the file doesn't exist."""
        abs_path = self._abs(key)
        if os.path.exists(abs_path):
            os.remove(abs_path)

    def serve(self, key: str, filename: str) -> Response:
        """Return a FastAPI FileResponse for direct file serving."""
        abs_path = self._abs(key)
        if not os.path.exists(abs_path):
            raise HTTPException(status_code=404, detail="File not found.")
        return FileResponse(path=abs_path, filename=filename,
                            media_type="application/octet-stream")

    def serve_inline(self, key: str) -> Response:
        """Return a FileResponse with Content-Disposition: inline (for PDF embed)."""
        import mimetypes
        abs_path = self._abs(key)
        if not os.path.exists(abs_path):
            raise HTTPException(status_code=404, detail="File not found.")
        mime, _ = mimetypes.guess_type(abs_path)
        return FileResponse(abs_path,
                            media_type=mime or "application/octet-stream",
                            headers={"Content-Disposition": "inline"})

    def abs_path(self, key: str) -> str:
        """Return the absolute local path for a key (needed for legacy email attachment code)."""
        return self._abs(key)


# ---------------------------------------------------------------------------
# AWS S3 / MinIO Backend
# ---------------------------------------------------------------------------

class _S3StorageBackend:
    """Stores files in an S3-compatible bucket via boto3."""

    def __init__(self):
        try:
            import boto3
        except ImportError:
            raise RuntimeError(
                "boto3 is not installed. Run: pip install boto3\n"
                "Or set STORAGE_BACKEND=local to use the local filesystem."
            )

        kwargs = dict(
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=AWS_REGION,
        )
        if AWS_S3_ENDPOINT_URL:
            # A custom endpoint means an S3-compatible store (MinIO, Ceph, etc.).
            # Those require path-style addressing — the default virtual-hosted style
            # would produce presigned URLs like http://<bucket>.localhost:9000/...
            # which don't resolve. Real AWS (no endpoint) keeps its default style.
            from botocore.config import Config
            kwargs["endpoint_url"] = AWS_S3_ENDPOINT_URL
            kwargs["config"] = Config(s3={"addressing_style": "path"})
        elif AWS_REGION:
            # Force the regional endpoint for real AWS so that presigned URLs
            # are signed AND served from the same regional domain
            # (e.g. s3.ap-south-1.amazonaws.com instead of s3.amazonaws.com).
            # Without this, boto3 defaults to the global endpoint but signs for
            # the configured region, causing SignatureDoesNotMatch on buckets
            # outside us-east-1.
            kwargs["endpoint_url"] = f"https://s3.{AWS_REGION}.amazonaws.com"

        import boto3
        self._s3 = boto3.client("s3", **kwargs)
        self._bucket = AWS_S3_BUCKET

        if not self._bucket:
            raise RuntimeError(
                "AWS_S3_BUCKET is not set in .env. "
                "Set it to your bucket name (e.g. hrm-uploads)."
            )

    def upload(self, file_data: bytes, key: str) -> str:
        """Upload bytes to S3. Returns the key."""
        import mimetypes
        key = _normalize_key(key)
        content_type, _ = mimetypes.guess_type(key)
        extra = {}
        if content_type:
            extra["ContentType"] = content_type
        self._s3.put_object(
            Bucket=self._bucket,
            Key=key,
            Body=file_data,
            **extra,
        )
        return key

    def get_url(self, key: str) -> str:
        """Generate a pre-signed URL valid for 1 hour."""
        key = _normalize_key(key)
        url = self._s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": key},
            ExpiresIn=3600,
        )
        return url

    def download(self, key: str) -> bytes:
        """Download and return file bytes from S3."""
        key = _normalize_key(key)
        try:
            obj = self._s3.get_object(Bucket=self._bucket, Key=key)
            return obj["Body"].read()
        except self._s3.exceptions.NoSuchKey:
            raise FileNotFoundError(f"S3 object not found: {key}")
        except Exception as e:
            raise RuntimeError(f"Failed to download from S3: {e}")

    def file_exists(self, key: str) -> bool:
        try:
            self._s3.head_object(Bucket=self._bucket, Key=_normalize_key(key))
            return True
        except Exception:
            return False

    def delete(self, key: str) -> None:
        """Delete an S3 object. Silently ignores if the key doesn't exist."""
        try:
            self._s3.delete_object(Bucket=self._bucket, Key=_normalize_key(key))
        except Exception:
            pass

    def serve(self, key: str, filename: str) -> Response:
        """Return a RedirectResponse to a pre-signed download URL."""
        url = self.get_url(key)
        return RedirectResponse(url=url, status_code=302)

    def serve_inline(self, key: str) -> Response:
        """Return a RedirectResponse to a pre-signed inline URL."""
        # Generate a pre-signed URL with ResponseContentDisposition=inline
        import mimetypes
        key = _normalize_key(key)
        content_type, _ = mimetypes.guess_type(key)
        url = self._s3.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": self._bucket,
                "Key": key,
                "ResponseContentDisposition": "inline",
                "ResponseContentType": content_type or "application/octet-stream",
            },
            ExpiresIn=3600,
        )
        return RedirectResponse(url=url, status_code=302)

    def abs_path(self, key: str) -> str:
        """
        In S3 mode, there is no local absolute path. Download the file to a
        temp file and return that path. The caller is responsible for cleanup.
        NOTE: Callers that use this method must delete the temp file themselves.
        This method is only used for the email attachment flow.
        """
        key = _normalize_key(key)
        data = self.download(key)
        ext = os.path.splitext(key)[1]
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
        tmp.write(data)
        tmp.close()
        return tmp.name


# ---------------------------------------------------------------------------
# Factory — pick the right backend based on STORAGE_BACKEND env var
# ---------------------------------------------------------------------------

def _create_backend():
    backend = STORAGE_BACKEND.strip().lower()
    if backend == "s3":
        print(f"[Storage] Using S3 backend — bucket: {AWS_S3_BUCKET}"
              + (f", endpoint: {AWS_S3_ENDPOINT_URL}" if AWS_S3_ENDPOINT_URL else " (real AWS)"))
        return _S3StorageBackend()
    else:
        if backend != "local":
            print(f"[Storage] Warning: Unknown STORAGE_BACKEND='{backend}'. Defaulting to local.")
        print("[Storage] Using local filesystem backend — uploads/ directory.")
        return _LocalStorageBackend()


# ---------------------------------------------------------------------------
# Public singleton — import this everywhere
# ---------------------------------------------------------------------------

storage = _create_backend()


# ---------------------------------------------------------------------------
# URL resolution helper
# ---------------------------------------------------------------------------

def resolve_public_url(value: Optional[str]) -> Optional[str]:
    """Resolve a stored image/file reference to a currently-valid public URL.

    We persist the *storage key* (e.g. "profiles/42.jpg") in the DB rather than a
    fully-formed URL. This lets us mint a fresh URL on every read — critical for
    the S3 backend whose pre-signed URLs expire after 1 hour. In local mode this
    just maps the key to its stable "/uploads/..." path.

    - Empty / None            → None
    - Absolute http(s) URL    → returned unchanged (legacy rows / external URLs)
    - Anything else           → treated as a storage key and resolved via get_url()
    """
    if not value:
        return None
    if value.startswith("http://") or value.startswith("https://"):
        return value
    return storage.get_url(value)
