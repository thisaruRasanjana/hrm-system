"""
AI Service HTTP Client

The recruitment module calls this module to request CV screening.
All communication with the AI service happens via HTTP — never via direct import.

Graceful degradation:
  If the AI service is unreachable or returns an error, this client returns a
  fallback result with ai_score=0.0 so the recruitment workflow is never blocked.
"""

import os
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


def _fallback(cv_file_path: str, reason: str) -> AIScreenResult:
    """Return a safe zero-score result when the AI service cannot be reached.
    full_name is intentionally empty so the caller keeps the original uploaded filename.
    """
    return AIScreenResult(
        full_name="",
        email=None,
        phone=None,
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
    """
    # Quick liveness check — avoids a long timeout if the service is clearly down
    try:
        health = httpx.get(f"{AI_SERVICE_URL}/health", timeout=5.0)
        if health.status_code != 200:
            return _fallback(
                cv_file_path,
                "AI service health check failed. Manual review required.",
            )
    except httpx.ConnectError:
        return _fallback(
            cv_file_path,
            "AI service is not running. Start ai_service/ and retry. Manual review required.",
        )
    except Exception as e:
        print(f"[ai_client] Health check error: {e}")
        return _fallback(cv_file_path, f"AI service unreachable: {e}")

    # Screen the candidate
    try:
        # Resolve relative paths → absolute so the AI service can find the file
        # regardless of its working directory.
        abs_cv_path = (
            cv_file_path if os.path.isabs(cv_file_path)
            else os.path.abspath(cv_file_path)
        )

        response = httpx.post(
            f"{AI_SERVICE_URL}/screen",
            json={
                "cv_file_path":    abs_cv_path,
                "title":           title,
                "experience_level": experience_level,
                "description":     description,
                "requirements":    requirements,
            },
            timeout=120.0,
        )
        response.raise_for_status()
        return AIScreenResult(**response.json())

    except httpx.HTTPStatusError as e:
        print(f"[ai_client] HTTP error {e.response.status_code}: {e.response.text}")
        return _fallback(cv_file_path, f"AI service returned an error ({e.response.status_code}).")

    except Exception as e:
        print(f"[ai_client] Unexpected error: {e}")
        return _fallback(cv_file_path, "AI screening failed due to an unexpected error.")
