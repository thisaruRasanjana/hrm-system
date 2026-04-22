"""
Centralized application configuration.
All environment variable access should go through this module.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:password@localhost:5432/hrm_db"
)

# ── AI Service (internal) ────────────────────────────────────────────────────
# The AI screening service runs as a separate process on port 8001.
# GEMINI_API_KEY lives in ai_service/.env, NOT here.
AI_SERVICE_URL: str = os.getenv("AI_SERVICE_URL", "http://127.0.0.1:8001")

# ── Email (SMTP) ──────────────────────────────────────────────────────────────
MAIL_USERNAME: str = os.getenv("MAIL_USERNAME", "")
MAIL_PASSWORD: str = os.getenv("MAIL_PASSWORD", "")
MAIL_FROM: str = os.getenv("MAIL_FROM", "noreply@hrm.local")
MAIL_PORT: int = int(os.getenv("MAIL_PORT", "587"))
MAIL_SERVER: str = os.getenv("MAIL_SERVER", "smtp.gmail.com")

# ── CORS ──────────────────────────────────────────────────────────────────────
CORS_ORIGINS: list[str] = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000"
).split(",")

# ── File Storage ──────────────────────────────────────────────────────────────
UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "uploads/cvs")
