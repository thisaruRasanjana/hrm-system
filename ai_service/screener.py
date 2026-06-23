"""
AI Screening Service — Multi-Provider Implementation.

Supports: Google Gemini, OpenAI (ChatGPT), Anthropic Claude.

All configuration is in ai_service/.env — no code changes needed to switch providers.

  AI_PROVIDER        = gemini | openai | claude
  AI_MODEL           = primary model name for the chosen provider
  AI_MODEL_FALLBACK  = fallback model (Gemini only, for quota exhaustion)
  AI_API_KEY         = API key for the chosen provider

Deliberately has ZERO imports from the main backend (app.*).
"""

import logging
import os
import re
import json
import time
from typing import Optional
from pathlib import Path
from dotenv import load_dotenv

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Load .env from the same directory as this file — safe regardless of CWD.
load_dotenv(Path(__file__).parent / ".env", override=True)

# ── Provider configuration ────────────────────────────────────────────────────
AI_PROVIDER: str        = os.getenv("AI_PROVIDER", "gemini").lower()
AI_MODEL: str           = os.getenv("AI_MODEL", "gemini-2.0-flash-lite")
AI_MODEL_FALLBACK: str  = os.getenv("AI_MODEL_FALLBACK", "gemini-2.5-flash-lite")

# AI_API_KEY is the unified key. Backward-compat: fall through to GEMINI_API_KEY
# so existing deployments with only GEMINI_API_KEY in .env keep working.
AI_API_KEY: str = os.getenv("AI_API_KEY", "") or os.getenv("GEMINI_API_KEY", "")

if not AI_API_KEY:
    logger.warning("[ai_service] No API key found in ai_service/.env (AI_API_KEY or GEMINI_API_KEY).")

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


# ── Text extraction ────────────────────────────────────────────────────

def _extract_text(file_path: str) -> str:
    """
    Extract plain text from a PDF or DOCX file.

    PDF strategy: try PyMuPDF (fitz) first — it handles complex encodings,
    compressed streams, and embedded fonts far better than PyPDF2.
    Falls back to PyPDF2 if fitz is unavailable or fails.
    """
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        # Primary: PyMuPDF (fitz) — most reliable for real-world CVs
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(file_path)
            text = "\n".join(page.get_text() for page in doc)
            doc.close()
            if text.strip():
                return text
        except Exception as e:
            logger.debug("[ai_service] PyMuPDF unavailable or failed: %s", e)

        # Fallback: PyPDF2
        try:
            from PyPDF2 import PdfReader
            reader = PdfReader(file_path)
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as e:
            logger.warning("[ai_service] PyPDF2 error: %s", e)
            return ""

    elif ext == ".docx":
        try:
            from docx import Document
            doc = Document(file_path)
            return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        except Exception as e:
            logger.warning("[ai_service] python-docx error: %s", e)
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
    """Return contact info extracted via regex + score=0 when AI is unavailable."""
    return ScreenResult(
        full_name=_parse_name(text) if text else "",
        email=_parse_email(text) if text else None,
        phone=_parse_phone(text) if text else None,
        ai_score=0.0,
        ai_reasoning=reason,
    )


# ── Shared prompt builder ─────────────────────────────────────────────────────

def _build_prompt(cv_text: str, title: str, experience_level: str,
                  description: str, requirements: str) -> str:
    return f"""You are a senior HR talent acquisition specialist with 15+ years of experience screening candidates across technical and non-technical roles. Your evaluations are objective, evidence-based, and calibrated to real hiring standards.

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

ANTI-HALLUCINATION RULES — strictly enforced:
  - Base your entire evaluation ONLY on text explicitly present in the CV above.
  - Do NOT infer, assume, or fabricate any skills, experience, or qualifications
    that are not directly stated in the CV text.
  - If the CV text is too short, vague, or lacks enough information to evaluate
    properly, assign ai_score = 0.0 and explain clearly in ai_reasoning.
  - If you cannot find a name, email, or phone number in the text, return null
    for that field. Never invent contact details.

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


def _parse_json_response(text: str) -> ScreenResult:
    """Parse a JSON string into a ScreenResult, stripping any markdown fences."""
    text = text.strip()
    if text.startswith("```"):
        text = "\n".join(
            line for line in text.splitlines()
            if not line.strip().startswith("```")
        ).strip()
    data = json.loads(text)
    return ScreenResult(**data)


# ── Custom exceptions ────────────────────────────────────────────────────

class QuotaExhaustedError(RuntimeError):
    """Raised when all AI models are quota-exhausted (HTTP 429)."""

class AIServiceError(RuntimeError):
    """Raised when the AI provider returns a non-quota error (server, auth, etc.)."""


# ── Per-provider call functions ────────────────────────────────────────────────────

def _call_gemini(prompt: str, cv_text: str, cv_file_path: str) -> ScreenResult:
    """
    Call Google Gemini with retry logic across primary + fallback models.
    Keeps the original 2-attempt × 2-model strategy that handles quota exhaustion.
    """
    # Dynamically reload the .env so key changes take effect without restart.
    load_dotenv(Path(__file__).parent / ".env", override=True)
    current_key = os.getenv("AI_API_KEY", "") or os.getenv("GEMINI_API_KEY", "")

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=current_key)
    models_to_try = [AI_MODEL, AI_MODEL_FALLBACK]

    # Track whether the final failure across all models was quota or something else.
    last_was_quota = False

    for model_name in models_to_try:
        for attempt in range(1, 3):  # max 2 attempts per model
            try:
                print(f"[ai_service] Gemini: trying {model_name} (attempt {attempt}/2)...")
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
                    logger.warning("[ai_service] %s returned empty response — skipping.", model_name)
                    last_was_quota = False
                    break

                data = json.loads(response.text)
                result = ScreenResult(**data)
                logger.info("[ai_service] Gemini scored with %s: %.1f", model_name, result.ai_score)
                return result

            except Exception as e:
                err_str = str(e)
                is_quota     = "429" in err_str or "RESOURCE_EXHAUSTED" in err_str
                is_not_found = "404" in err_str or "NOT_FOUND" in err_str
                is_server    = "503" in err_str or "UNAVAILABLE" in err_str

                logger.debug(
                    "[ai_service] %s attempt %d failed: %s: %s",
                    model_name, attempt, type(e).__name__, str(e)[:150],
                )

                if is_quota:
                    logger.warning("[ai_service] Quota exhausted on %s — trying next model.", model_name)
                    last_was_quota = True
                    break
                elif is_not_found:
                    logger.warning("[ai_service] %s not found — trying next model.", model_name)
                    last_was_quota = False
                    break
                elif is_server and attempt < 2:
                    logger.warning("[ai_service] Server error on %s — retrying in 10s...", model_name)
                    last_was_quota = False
                    time.sleep(10)
                else:
                    last_was_quota = False
                    break

    if last_was_quota:
        raise QuotaExhaustedError("All Gemini models quota-exhausted (HTTP 429).")
    raise AIServiceError("All Gemini models failed due to server or API errors.")


def _call_openai(prompt: str) -> ScreenResult:
    """Call OpenAI (ChatGPT, GPT-4o, etc.) and return a ScreenResult."""
    from openai import OpenAI

    client = OpenAI(api_key=AI_API_KEY)
    print(f"[ai_service] OpenAI: calling {AI_MODEL}...")
    response = client.chat.completions.create(
        model=AI_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a senior HR talent acquisition specialist. "
                    "Always respond with valid JSON only — no markdown fences, no commentary."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
        response_format={"type": "json_object"},
    )
    content = response.choices[0].message.content or ""
    result = _parse_json_response(content)
    logger.info("[ai_service] OpenAI scored with %s: %.1f", AI_MODEL, result.ai_score)
    return result


def _call_claude(prompt: str) -> ScreenResult:
    """Call Anthropic Claude and return a ScreenResult."""
    import anthropic

    client = anthropic.Anthropic(api_key=AI_API_KEY)
    print(f"[ai_service] Claude: calling {AI_MODEL}...")
    message = client.messages.create(
        model=AI_MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )
    content = message.content[0].text if message.content else ""
    result = _parse_json_response(content)
    logger.info("[ai_service] Claude scored with %s: %.1f", AI_MODEL, result.ai_score)
    return result


# ── Provider dispatch ─────────────────────────────────────────────────────────

_PROVIDER_MAP = {
    "gemini": lambda prompt, cv_text, cv_file_path: _call_gemini(prompt, cv_text, cv_file_path),
    "openai": lambda prompt, cv_text, cv_file_path: _call_openai(prompt),
    "claude": lambda prompt, cv_text, cv_file_path: _call_claude(prompt),
}


# ── Main screening function ───────────────────────────────────────────────────

def screen_cv(
    cv_file_path:     str,
    title:            Optional[str] = None,
    experience_level: Optional[str] = None,
    description:      Optional[str] = None,
    requirements:     Optional[str] = None,
) -> ScreenResult:
    """
    Parse a CV and score it against a vacancy using the configured AI provider.

    Provider is chosen via AI_PROVIDER in ai_service/.env.
    Falls back to score=0 with regex-extracted contact info if the provider fails.
    """
    # ── Step 1: Validate file ─────────────────────────────────────────────────
    if not os.path.exists(cv_file_path):
        return _fallback_result(cv_file_path, "", "CV file not found on disk.")

    cv_text = _extract_text(cv_file_path)

    if not cv_text.strip():
        return _fallback_result(
            cv_file_path, "",
            "Could not extract readable text from this document. "
            "It may be image-based or corrupted.",
        )

    # Catch blank or placeholder files (e.g. documents with only a label like "Cv 1").
    # 50 chars is a very low bar — any real CV will far exceed this.
    if len(cv_text.strip()) < 50:
        return _fallback_result(
            cv_file_path, cv_text,
            "This document does not contain CV content. "
            "It appears to be a blank or placeholder file.",
        )

    # ── Step 2: API key guard ─────────────────────────────────────────────────
    if not AI_API_KEY:
        return _fallback_result(
            cv_file_path, cv_text,
            f"AI scoring unavailable: AI_API_KEY not configured in ai_service/.env.",
        )

    # ── Step 3: Provider guard ────────────────────────────────────────────────
    provider_fn = _PROVIDER_MAP.get(AI_PROVIDER)
    if not provider_fn:
        return _fallback_result(
            cv_file_path, cv_text,
            f"Unknown AI_PROVIDER '{AI_PROVIDER}'. "
            f"Must be one of: gemini, openai, claude.",
        )

    # ── Step 4: Build prompt ──────────────────────────────────────────────────
    prompt = _build_prompt(
        cv_text, title or "", experience_level or "",
        description or "", requirements or "",
    )

    # ── Step 5: Call provider ──────────────────────────────────────────────────
    try:
        return provider_fn(prompt, cv_text, cv_file_path)
    except QuotaExhaustedError:
        logger.error("[ai_service] %s quota exhausted across all models.", AI_PROVIDER)
        return _fallback_result(
            cv_file_path, cv_text,
            "AI screening quota was temporarily exceeded. "
            "The score will remain 0 until re-screened. "
            "Please try again in a few minutes.",
        )
    except AIServiceError as e:
        logger.error("[ai_service] %s service error: %s", AI_PROVIDER, e)
        return _fallback_result(
            cv_file_path, cv_text,
            "AI screening failed due to a temporary service error. "
            "Please try re-screening this candidate.",
        )
    except Exception as e:
        logger.error("[ai_service] %s unexpected error: %s", AI_PROVIDER, e)
        return _fallback_result(
            cv_file_path, cv_text,
            "AI screening encountered an unexpected error. "
            "Please try re-screening this candidate.",
        )