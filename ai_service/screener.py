"""
CV Screener — Core logic for the AI Screening Service.

Uses the google-genai SDK (v1.x) which targets the v1beta API.
Compatible models (confirmed via ListModels): gemini-2.0-flash-lite, gemini-2.5-flash-lite, etc.
NOTE: gemini-1.5-* models are NOT available in this SDK/API version.

Model configuration is read from ai_service/.env:
  GEMINI_MODEL          — primary model (default: gemini-2.0-flash-lite)
  GEMINI_MODEL_FALLBACK — fallback model (default: gemini-2.5-flash-lite)

Deliberately has ZERO imports from the main backend (app.*).
"""

import os
import re
import json
import time
from typing import Optional
from pathlib import Path
from dotenv import load_dotenv

from pydantic import BaseModel, Field
from google import genai
from google.genai import types

# Load .env from the same directory as this file — safe regardless of CWD.
load_dotenv(Path(__file__).parent / ".env", override=True)

GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
if not GEMINI_API_KEY:
    print("[ai_service] WARNING: GEMINI_API_KEY not found in ai_service/.env")

# Both models must be from the gemini-2.x family for this SDK version.
# They are configurable via ai_service/.env so no code change is needed
# when switching models in production.
GEMINI_MODEL: str          = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-lite")
GEMINI_MODEL_FALLBACK: str = os.getenv("GEMINI_MODEL_FALLBACK", "gemini-2.5-flash-lite")

# ── Regex helpers ─────────────────────────────────────────────────────────────
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


# ── Regex-based contact parser ────────────────────────────────────────────────

def _parse_name(text: str) -> str:
    for line in text.split("\n"):
        line = line.strip()
        if not line or "@" in line or "http" in line.lower():
            continue
        if _NAME_RE.match(line):
            return line
    return ""


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
    """Return contact info extracted via regex + score=0 when Gemini is unavailable."""
    return ScreenResult(
        full_name=_parse_name(text) if text else "",
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
    Falls back to score=0 with regex-extracted contact info if Gemini fails.
    """
    # ── Step 1: Extract text ──────────────────────────────────────────────────
    if not os.path.exists(cv_file_path):
        return _fallback_result(cv_file_path, "", "CV file not found on disk.")

    cv_text = _extract_text(cv_file_path)

    if not cv_text.strip():
        return _fallback_result(
            cv_file_path, "",
            "Could not extract readable text from this document. It may be image-based or corrupted.",
        )

    # ── Step 2: API key guard ─────────────────────────────────────────────────
    if not GEMINI_API_KEY:
        return _fallback_result(
            cv_file_path, cv_text,
            "AI scoring unavailable: GEMINI_API_KEY not configured in ai_service/.env.",
        )

    # ── Step 3: Build prompt ──────────────────────────────────────────────────
    prompt = f"""You are a senior HR talent acquisition specialist with 15+ years of experience screening candidates across technical and non-technical roles. Your evaluations are objective, evidence-based, and calibrated to real hiring standards.

════════════════════════════════════════
VACANCY
════════════════════════════════════════
Job Title:        {title            or 'N/A'}
Experience Level: {experience_level or 'N/A'}
Job Description:  {description      or 'N/A'}
Requirements:     {requirements     or 'N/A'}

════════════════════════════════════════
CANDIDATE CV
════════════════════════════════════════
{cv_text[:8000]}

════════════════════════════════════════
EVALUATION INSTRUCTIONS
════════════════════════════════════════
Before producing output, internally reason through the following dimensions:

1. SKILLS MATCH
   - Which required skills/technologies does the candidate explicitly demonstrate?
   - Which are absent or only implied?
   - Are any critical (must-have) requirements unmet?

2. EXPERIENCE FIT
   - Does total years and depth of experience match the seniority level?
   - Penalise significantly if the candidate is clearly overqualified (>2 levels above)
     or underqualified (<50% of the expected experience).
   - Look for progression, leadership, and scope of responsibility where relevant.

3. EDUCATION & CERTIFICATIONS
   - Are academic qualifications relevant and at the expected level?
   - Do certifications add genuine value for this role?

4. ROLE-SPECIFIC SIGNALS
   - For technical roles: concrete projects, measurable outcomes, tools used.
   - For non-technical roles: domain knowledge, communication evidence, achievements.
   - Quantified accomplishments (numbers, percentages, scale) are strong positive signals.

5. RED FLAGS
   - Unexplained employment gaps > 12 months.
   - Frequent short tenures (< 1 year) across multiple jobs.
   - CV that appears padded or vague without substance.
   - Each red flag should reduce the score modestly (3–8 points each).

SCORING CALIBRATION — be precise, do not cluster scores around round numbers:
  85–100 : Exceptional match. Meets virtually all requirements; experience level is spot-on.
  70–84  : Strong match. Meets most requirements; minor gaps that are easily bridgeable.
  50–69  : Moderate match. Relevant background but meaningful gaps in skills or seniority.
  25–49  : Weak match. Some transferable skills but falls short on core requirements.
  0–24   : Poor match. Does not meet the fundamental requirements of the role.

REASONING STYLE for ai_reasoning:
  - Be specific: name the skills matched, the gaps found, and the seniority verdict.
  - Do NOT use generic phrases like "the candidate shows potential."
  - Tone: professional, direct, evidence-backed (as you would write in an ATS note).
  - Exactly 2–3 sentences.

════════════════════════════════════════
OUTPUT
════════════════════════════════════════
Return ONLY a valid JSON object — no markdown fences, no commentary:
{{
  "full_name":    "<candidate full name as written on the CV>",
  "email":        "<email address or null>",
  "phone":        "<phone number or null>",
  "ai_score":     <float 0.0–100.0>,
  "ai_reasoning": "<2–3 sentence evidence-based justification>"
}}
"""

    # ── Step 4: Call Gemini ───────────────────────────────────────────────────
    client = genai.Client(api_key=GEMINI_API_KEY)
    models_to_try = [GEMINI_MODEL, GEMINI_MODEL_FALLBACK]

    for model_name in models_to_try:
        for attempt in range(1, 3):  # max 2 attempts per model
            try:
                print(f"[ai_service] Attempting {model_name} (attempt {attempt}/2)...")
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=ScreenResult,
                        temperature=0.2,
                    ),
                )
                if not response.text:
                    print(f"[ai_service] {model_name} returned empty response — skipping.")
                    break

                data = json.loads(response.text)
                result = ScreenResult(**data)
                print(f"[ai_service] ✓ Scored with {model_name}: {result.ai_score}")
                return result

            except Exception as e:
                err_str = str(e)
                is_quota     = "429" in err_str or "RESOURCE_EXHAUSTED" in err_str
                is_not_found = "404" in err_str or "NOT_FOUND" in err_str
                is_server    = "503" in err_str or "UNAVAILABLE" in err_str

                print(f"[ai_service] {model_name} attempt {attempt} failed: {type(e).__name__}: {err_str[:150]}")

                if is_quota:
                    print(f"[ai_service] Quota exhausted on {model_name} — trying next model.")
                    break
                elif is_not_found:
                    print(f"[ai_service] {model_name} not found in this API version — trying next model.")
                    break
                elif is_server and attempt < 2:
                    print(f"[ai_service] Server error — retrying in 10s...")
                    time.sleep(10)
                else:
                    break

    # ── Step 5: All models failed ─────────────────────────────────────────────
    return _fallback_result(
        cv_file_path, cv_text,
        "AI scoring unavailable (quota exhausted or API error). "
        "Re-run screening once your API quota resets. Contact info extracted via regex parser.",
    )