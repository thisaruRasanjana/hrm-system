"""
HRM AI Screening Service — Standalone FastAPI Application

Responsibilities:
  - Accept CV file paths + vacancy context via REST
  - Parse CV text (PDF / DOCX)
  - Call Google Gemini to extract candidate info and compute a relevance score
  - Return structured JSON result

Runs independently on port 8001.
The main HRM backend communicates with this service via HTTP (never via direct import).
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from screener import screen_cv, ScreenResult

app = FastAPI(
    title="HRM AI Screening Service",
    description="Independent internal service for CV parsing and AI-powered candidate scoring.",
    version="1.0.0",
)

# Only allow requests from the main backend (tighten this in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://127.0.0.1:8000"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


# ── Request / Response schemas ─────────────────────────────────────────────────

class ScreenRequest(BaseModel):
    cv_file_path:     str
    title:            Optional[str] = None
    experience_level: Optional[str] = None
    description:      Optional[str] = None
    requirements:     Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    """Liveness probe — used by the main backend to verify this service is up."""
    return {"status": "ok", "service": "ai-screening"}


@app.post("/screen", response_model=ScreenResult)
def screen_candidate(req: ScreenRequest):
    """
    Screen a candidate CV against a vacancy.

    Accepts the path to a locally saved CV file plus vacancy context.
    Returns extracted candidate info (name, email, phone) and an AI relevance score.

    Note: In a containerised deployment, ensure both services mount the same
    storage volume, or switch cv_file_path for a pre-signed S3 URL.
    """
    if not req.cv_file_path:
        raise HTTPException(status_code=400, detail="cv_file_path is required.")

    return screen_cv(
        cv_file_path=req.cv_file_path,
        title=req.title,
        experience_level=req.experience_level,
        description=req.description,
        requirements=req.requirements,
    )
