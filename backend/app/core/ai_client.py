"""
AI Service HTTP Client

The recruitment module calls this module to request CV screening.
All communication with the AI service happens via HTTP — never via direct import.

Graceful degradation:
  If the AI service is unreachable or returns an error, this client attempts to
  extract name, email, and phone via regex directly from the CV file so the
  candidate record is never left showing "Processing...".
  ai_score will be 0.0 (no AI ranking) but contact details will still be populated.
"""

import os
import re
import httpx
from pydantic import BaseModel
from typing import Optional

from app.core.config import AI_SERVICE_URL


class AIScreenResult(BaseModel):
    full_name:    str
    email:        Optional[str] = None
    phone:        Optional[str] = None
    ai_score:     float = 0.0
    ai_reasoning: str  = ""


# ── Regex helpers (mirrors ai_service/screener.py) ────────────────────────────

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE_RE = re.compile(
    r"(?:\+?\d{1,3}[.\-\s]?)?(?:\(\d{2,4}\)[.\-\s]?)?\d{3,4}[.\-\s]?\d{3,4}"
)
_NAME_RE  = re.compile(r"^[A-Za-z][A-Za-z\s.\'-]{2,40}$")


def _extract_text_from_cv(cv_file_path: str) -> str:
    """Extract plain text from a PDF or DOCX file for regex parsing."""
    if not cv_file_path or not os.path.exists(cv_file_path):
        return ""
    ext = os.path.splitext(cv_file_path)[1].lower()
    try:
        if ext == ".pdf":
            # Primary: PyMuPDF
            try:
                import fitz
                doc = fitz.open(cv_file_path)
                text = "\n".join(page.get_text() for page in doc)
                doc.close()
                if text.strip():
                    return text
            except Exception:
                pass
            # Fallback: PyPDF2
            try:
                from PyPDF2 import PdfReader
                reader = PdfReader(cv_file_path)
                return "\n".join(page.extract_text() or "" for page in reader.pages)
            except Exception:
                return ""
        elif ext == ".docx":
            from docx import Document
            doc = Document(cv_file_path)
            return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    except Exception:
        pass
    return ""


def _regex_parse(text: str) -> tuple:
    """Extract (name, email, phone) from raw CV text using regex."""
    # Name: first non-URL, non-email line that looks like a real name
    name = ""
    for line in text.split("\n"):
        line = line.strip()
        if not line or "@" in line or "http" in line.lower():
            continue
        if _NAME_RE.match(line):
            name = line
            break

    # Email
    email_match = _EMAIL_RE.search(text)
    email = email_match.group(0) if email_match else None

    # Phone
    phone = None
    phone_match = _PHONE_RE.search(text)
    if phone_match:
        candidate_phone = phone_match.group(0).strip()
        if len(re.sub(r"\D", "", candidate_phone)) >= 7:
            phone = candidate_phone

    return name, email, phone


def _fallback(cv_file_path: str, reason: str) -> AIScreenResult:
    """
    Return a best-effort result when the AI service cannot be reached.

    Attempts regex extraction of name/email/phone so the candidate record
    is never left blank. ai_score is always 0.0 (no AI ranking possible).
    """
    text = _extract_text_from_cv(cv_file_path)
    name, email, phone = _regex_parse(text) if text else ("", None, None)
    return AIScreenResult(
        full_name=name,   # empty string → caller keeps the original filename as fallback
        email=email,
        phone=phone if phone else None,
        ai_score=0.0,
        ai_reasoning=reason,
    )


def screen_candidate(
    cv_file_path:     str,
    title:            Optional[str] = None,
    experience_level: Optional[str] = None,
    description:      Optional[str] = None,
    requirements:     Optional[str] = None,
) -> AIScreenResult:
    """
    Call the AI Screening Service via HTTP POST /screen.

    Uses a synchronous httpx client — safe to call from background tasks
    and synchronous route handlers.

    Timeout: 120 s (Gemini can be slow on large CVs).
    Falls back to regex parsing of the CV if the service is unreachable.
    """
    # Quick liveness check — avoids a long timeout if the service is clearly down
    try:
        health = httpx.get(f"{AI_SERVICE_URL}/health", timeout=5.0)
        if health.status_code != 200:
            return _fallback(
                cv_file_path,
                "AI service health check failed. Contact info extracted via regex. Manual score review required.",
            )
    except httpx.ConnectError:
        return _fallback(
            cv_file_path,
            "AI service is not running. Contact info extracted via regex. Start ai_service/ to enable AI scoring.",
        )
    except Exception as e:
        print(f"[ai_client] Health check error: {e}")
        return _fallback(cv_file_path, f"AI service unreachable ({e}). Contact info extracted via regex.")

    # Screen the candidate
    try:
        abs_cv_path = (
            cv_file_path if os.path.isabs(cv_file_path)
            else os.path.abspath(cv_file_path)
        )

        response = httpx.post(
            f"{AI_SERVICE_URL}/screen",
            json={
                "cv_file_path":     abs_cv_path,
                "title":            title,
                "experience_level": experience_level,
                "description":      description,
                "requirements":     requirements,
            },
            timeout=120.0,
        )
        response.raise_for_status()
        raw = response.json()
        # Normalize "null" strings the AI model may have returned instead of JSON null
        _null_strings = {"null", "none", "n/a", "na", "not found", "not provided", "unknown", ""}
        for field in ("email", "phone"):
            v = raw.get(field)
            if isinstance(v, str) and v.strip().lower() in _null_strings:
                raw[field] = None
        fn = raw.get("full_name", "")
        if isinstance(fn, str) and fn.strip().lower() in _null_strings:
            raw["full_name"] = ""
        return AIScreenResult(**raw)

    except httpx.HTTPStatusError as e:
        print(f"[ai_client] HTTP error {e.response.status_code}: {e.response.text}")
        return _fallback(
            cv_file_path,
            f"AI service returned an error ({e.response.status_code}). Contact info extracted via regex.",
        )

    except Exception as e:
        print(f"[ai_client] Unexpected error: {e}")
        return _fallback(cv_file_path, "AI screening failed. Contact info extracted via regex.")
