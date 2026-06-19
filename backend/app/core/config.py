"""
Centralized application configuration.
All environment variable access should go through this module.
"""
import os
from dotenv import load_dotenv

load_dotenv(override=True)

# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:password@localhost:5432/hrm_db"
)

# ── AI Service (internal) ────────────────────────────────────────────────────
# The AI screening service runs as a separate process on port 8001.
# GEMINI_API_KEY lives in ai_service/.env, NOT here.
AI_SERVICE_URL: str = os.getenv("AI_SERVICE_URL", "http://127.0.0.1:8001")

# ── Google reCAPTCHA v2 ───────────────────────────────────────────────────────
# Set RECAPTCHA_SECRET_KEY in your .env file.
# Leave empty to disable verification in local dev (non-empty = always verified).
RECAPTCHA_SECRET_KEY: str = os.getenv("RECAPTCHA_SECRET_KEY", "")

# ── Email (SMTP) ──────────────────────────────────────────────────────────────
MAIL_USERNAME: str = os.getenv("MAIL_USERNAME", "")
MAIL_PASSWORD: str = os.getenv("MAIL_PASSWORD", "")
MAIL_FROM: str = os.getenv("MAIL_FROM", "noreply@hrm.com")
MAIL_PORT: int = int(os.getenv("MAIL_PORT", "587"))
MAIL_SERVER: str = os.getenv("MAIL_SERVER", "smtp.gmail.com")

# ── CORS ──────────────────────────────────────────────────────────────────────
CORS_ORIGINS: list[str] = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000"
).split(",")

# ── File Storage ──────────────────────────────────────────────────────────────
UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "uploads/cvs")

# ── IMAP (Document email poller) ──────────────────────────────────────────────
IMAP_SERVER: str = os.getenv("IMAP_SERVER", "imap.gmail.com")
IMAP_USER: str = os.getenv("IMAP_USER", os.getenv("MAIL_USERNAME", ""))
IMAP_PASSWORD: str = os.getenv("IMAP_PASSWORD", os.getenv("MAIL_PASSWORD", ""))
SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))

# ── Document storage ──────────────────────────────────────────────────────────
UPLOAD_DIR_DOCUMENTS: str = os.getenv("UPLOAD_DIR_DOCUMENTS", "uploads/documents")
UPLOAD_DIR_TEMPLATES: str = os.getenv("UPLOAD_DIR_TEMPLATES", "uploads/templates")
UPLOAD_DIR_GENERATED: str = os.getenv("UPLOAD_DIR_GENERATED", "uploads/generated_documents")
MAX_FILE_SIZE_BYTES: int = int(os.getenv("MAX_FILE_SIZE_BYTES", str(10 * 1024 * 1024)))
EMAIL_POLL_INTERVAL_SECONDS: int = int(os.getenv("EMAIL_POLL_INTERVAL_SECONDS", "60"))


class _Settings:
    """Compatibility shim so document services can call get_settings()."""
    imap_server: str = IMAP_SERVER
    imap_user: str = IMAP_USER
    imap_password: str = IMAP_PASSWORD
    smtp_server: str = MAIL_SERVER
    smtp_port: int = SMTP_PORT
    upload_dir_documents: str = UPLOAD_DIR_DOCUMENTS
    upload_dir_templates: str = UPLOAD_DIR_TEMPLATES
    upload_dir_generated: str = UPLOAD_DIR_GENERATED
    max_file_size_bytes: int = MAX_FILE_SIZE_BYTES
    email_poll_interval_seconds: int = EMAIL_POLL_INTERVAL_SECONDS

    def __init__(self):
        self.imap_server = IMAP_SERVER
        self.imap_user = IMAP_USER
        self.imap_password = IMAP_PASSWORD
        self.smtp_server = MAIL_SERVER
        self.smtp_port = SMTP_PORT
        self.upload_dir_documents = UPLOAD_DIR_DOCUMENTS
        self.upload_dir_templates = UPLOAD_DIR_TEMPLATES
        self.upload_dir_generated = UPLOAD_DIR_GENERATED
        self.max_file_size_bytes = MAX_FILE_SIZE_BYTES
        self.email_poll_interval_seconds = EMAIL_POLL_INTERVAL_SECONDS


_settings_instance = _Settings()

def get_settings() -> _Settings:
    return _settings_instance
