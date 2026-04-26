"""
core/config.py
==============
Centralised application settings loaded from environment variables.

Using Pydantic BaseSettings ensures:
- Every required variable is type-checked at startup.
- Missing variables cause an explicit, descriptive error instead of a
  silent None that explodes later in the code.
- All config lives in ONE place — easy to audit and defend.
"""

import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application-wide configuration loaded from the .env file."""

    # ── Database ──────────────────────────────────────────────────────────────
    db_host: str
    db_port: int = 5432
    db_name: str
    db_user: str
    db_password: str

    # ── Email / IMAP ──────────────────────────────────────────────────────────
    imap_server: str = "imap.gmail.com"
    smtp_server: str = "smtp.gmail.com"
    smtp_port: int = 587
    imap_user: str = ""
    imap_password: str = ""

    # ── File storage ─────────────────────────────────────────────────────────
    upload_dir_documents: str = "uploads/documents"
    upload_dir_templates: str = "uploads/templates"
    upload_dir_generated: str = "uploads/generated_documents"
    max_file_size_bytes: int = 10 * 1024 * 1024   # 10 MB

    # ── Email poller ──────────────────────────────────────────────────────────
    email_poll_interval_seconds: int = 60

    # Pydantic V2 config: read from a .env file in the working directory
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",         # ignore extra env vars we don't declare
    )


@lru_cache
def get_settings() -> Settings:
    """Return a cached singleton Settings instance.

    Using lru_cache means the .env file is read exactly once at startup,
    not on every request — a meaningful performance and safety improvement.
    """
    return Settings()
