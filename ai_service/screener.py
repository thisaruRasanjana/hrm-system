"""
CV Screener — Core logic for the AI Screening Service.

Combines:
  - Text extraction  (PDF via PyPDF2, DOCX via python-docx)
  - Fallback parsing (regex name / email / phone — runs even without Gemini)
  - Gemini scoring   (extracts structured JSON via gemini-2.5-flash)

Deliberately has ZERO imports from the main backend (app.*).
All config is loaded from the local .env via python-dotenv.
"""

import os
import re
import json
from typing import Optional
from pathlib import Path
from dotenv import load_dotenv

from pydantic import BaseModel, Field
from google import genai
from google.genai import types

# Load .env from the same directory as this file — safe regardless of CWD.
# override=True ensures the .env value replaces any stale empty variable
# that may have been set during a previous server run.
load_dotenv(Path(__file__).parent / ".env", override=True)

import time

GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
if not GEMINI_API_KEY:
    print("[ai_service] WARNING: GEMINI_API_KEY not found in ai_service/.env")

# Primary model — configurable via env; lite is smaller/faster and has separate quota
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
# Fallback tried if primary returns 503/429
GEMINI_MODEL_FALLBACK: str = "gemini-2.5-flash"

# ── Regex helpers (fallback when Gemini unavailable) ──────────────────────────
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE_RE = re.compile(
    r"(?:\+?\d{1,3}[.\-\s]?)?(?:\(?\d{2,4}\)?[.\-\s]?)?\d{3,4}[.\-\s]?\d{3,4}"
)
_NAME_RE  = re.compile(r"^[A-Za-z][A-Za-z\s.\'-]{2,40}$")


# ── Return schema (shared with main.py) ───────────────────────────────────────

class ScreenResult(BaseModel):
    full_name:    str            = Field(description="Candidate full name extracted from the CV.")
    email:        Optional[str]  = Field(None, description="Email address, null if not found.")
    phone:        Optional[str]  = Field(None, description="Phone number, null if not found.")
    ai_score:     float          = Field(description="Match score 0–100 against vacancy requirements.")
    ai_reasoning: str            = Field(description="2–3 sentence professional justification.")


# ── Text extraction ───────────────────────────────────────────────────────────

def _extract_text(file_path: str) -> str:
    """Extract plain text from a PDF or DOCX file."""
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        try:
            from PyPDF2 import PdfReader
            reader = PdfReader(file_path)
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as e:
            print(f"[ai_service] PyPDF2 error: {e}")
            return ""

    elif ext == ".docx":
        try:
            from docx import Document
            doc = Document(file_path)
            return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        except Exception as e:
            print(f"[ai_service] python-docx error: {e}")
            return ""

    return ""


# ── Regex-based fallback parser ───────────────────────────────────────────────

def _parse_name(text: str, fallback: str) -> str:
    for line in text.split("\n"):
        line = line.strip()
        if not line or "@" in line or "http" in line.lower():
            continue
        if _NAME_RE.match(line):
            return line
    return fallback


def _parse_email(text: str) -> Optional[str]:
    m = _EMAIL_RE.search(text)
    return m.group(0) if m else None


def _parse_phone(text: str) -> Optional[str]:
    m = _PHONE_RE.search(text)
    if m:
        phone = m.group(0).strip()
        if len(re.sub(r"\D", "", phone)) >= 7:
            return phone
    return None


def _fallback_result(file_path: str, text: str, reason: str) -> ScreenResult:
    """Build a best-effort result from regex parsing when Gemini is unavailable.
    full_name is intentionally empty so the backend keeps the original uploaded filename.
    """
    return ScreenResult(
        full_name="",
        email=_parse_email(text) if text else None,
        phone=_parse_phone(text) if text else None,
        ai_score=0.0,
        ai_reasoning=reason,
    )


# ── Main screening function ───────────────────────────────────────────────────

def screen_cv(
    cv_file_path:     str,
    title:            Optional[str] = None,
    experience_level: Optional[str] = None,
    description:      Optional[str] = None,
    requirements:     Optional[str] = None,
) -> ScreenResult:
    """
    Parse a CV and score it against a vacancy using Google Gemini.

    Falls back gracefully to regex-parsed data with score=0 if:
      - The file cannot be read
      - GEMINI_API_KEY is not set
      - The Gemini API call fails
    """
    # ── Step 1: Extract text ─────────────────────────────────────────────────
    if not os.path.exists(cv_file_path):
        return _fallback_result(cv_file_path, "", "CV file not found on disk.")

    cv_text = _extract_text(cv_file_path)

    if not cv_text.strip():
        return _fallback_result(
            cv_file_path, "",
            "Could not extract readable text from this document. It may be image-based or corrupted.",
        )

    # ── Step 2: Guard — API key required ─────────────────────────────────────
    if not GEMINI_API_KEY:
        print("[ai_service] WARNING: GEMINI_API_KEY not set. Falling back to regex parsing.")
        return _fallback_result(
            cv_file_path, cv_text,
            "AI scoring unavailable: GEMINI_API_KEY not configured. Candidate info extracted via fallback parser.",
        )

    # ── Step 3: Call Gemini with retry + model fallback ──────────────────────
    prompt = f"""You are an expert HR Recruitment AI. Your task is to evaluate a candidate's CV against a specific job vacancy.

Vacancy Details:
  Job Title:        {title            or 'N/A'}
  Experience Level: {experience_level or 'N/A'}
  Job Description:  {description      or 'N/A'}
  Requirements:     {requirements     or 'N/A'}

Candidate CV:
---
{cv_text[:8000]}
---

Your evaluation must:
1. Extract the candidate's full name, email address, and phone number from the CV.
2. Assign an `ai_score` from 0.0 to 100.0 reflecting how well the candidate matches the vacancy.
   - Consider: relevant experience, skills match, qualifications, and seniority fit for a {experience_level or 'specified'}-level role.
   - A candidate overqualified or underqualified for the experience level should score lower.
3. Write a concise 2-to-3 sentence `ai_reasoning` in professional HR language that justifies the score.

Return ONLY valid JSON matching the required schema. Do not include markdown or explanation.
"""

    client = genai.Client(api_key=GEMINI_API_KEY)
    models_to_try = [GEMINI_MODEL, GEMINI_MODEL_FALLBACK]
    retry_delays = [5, 15, 30]  # seconds between retries

    for model_name in models_to_try:
        for attempt, delay in enumerate(retry_delays, start=1):
            try:
                print(f"[ai_service] Attempting {model_name} (attempt {attempt}/3)...")
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=ScreenResult,
                        temperature=0.2,
                    ),
                )
                if response.text:
                    data = json.loads(response.text)
                    result = ScreenResult(**data)
                    print(f"[ai_service] ✓ Scored with {model_name}: {result.ai_score}")
                    return result
                break  # Got a response but no text — move to next model

            except Exception as e:
                err_str = str(e)
                is_retryable = "503" in err_str or "429" in err_str or "UNAVAILABLE" in err_str or "EXHAUSTED" in err_str
                print(f"[ai_service] {model_name} attempt {attempt} failed: {type(e).__name__}: {err_str[:120]}")

                if is_retryable and attempt < len(retry_delays):
                    print(f"[ai_service] Retrying in {delay}s...")
                    time.sleep(delay)
                else:
                    print(f"[ai_service] Switching to next model or giving up.")
                    break

    # ── Step 4: All models failed — regex fallback ────────────────────────────
    return _fallback_result(
        cv_file_path, cv_text,
        "AI scoring temporarily unavailable (rate limit or service overload). Candidate info extracted via fallback parser. Try re-running screening later.",
    )

