"""
documents/constants.py
======================
Centralised named constants for the documents module.
Using named constants instead of magic literals makes the intent clear and
allows a single-point change if limits ever need to be updated.
"""

# ── Upload Directories ────────────────────────────────────────────────────────
UPLOAD_DIR_DOCUMENTS: str = "uploads/documents"
UPLOAD_DIR_TEMPLATES: str = "uploads/templates"
UPLOAD_DIR_GENERATED: str = "uploads/generated_documents"

# ── Allowed MIME types for employee document uploads ─────────────────────────
ALLOWED_MIME_TYPES: list[str] = [
    "application/pdf",
    "image/jpeg",
    "image/png",
]

# ── File size limit: 10 MB (prevents abuse / runaway storage) ────────────────
MAX_FILE_SIZE_BYTES: int = 10 * 1024 * 1024   # 10 MB

# ── Length of the random hex suffix appended to generated file names ─────────
FILENAME_SUFFIX_LENGTH: int = 6

# ── Maximum lengths for user-supplied text fields ────────────────────────────
DOCUMENT_TYPE_NAME_MAX_LENGTH: int = 150
REASON_MAX_LENGTH: int = 2000
REJECTION_REASON_MIN_LENGTH: int = 10

# ── Reviewer ID used while real auth is not yet wired into approval flow ─────
# WHY: A named constant makes it obvious this is a placeholder, not real logic.
DEMO_REVIEWER_ID: int = 1

# ── Email poller ─────────────────────────────────────────────────────────────
EMAIL_POLL_INTERVAL_SECONDS: int = 60
EMAIL_IMAP_TIMEOUT_SECONDS: int = 15
