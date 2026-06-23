"""
AI Screening Service — Legacy inline implementation (reference only).

NOTE: This file is NOT used by the recruitment module.
The active AI screening runs in the standalone ai_service/ microservice
(ai_service/screener.py) which is called via HTTP through app/core/ai_client.py.

This file is kept here only as a historical reference for the original
inline implementation that predated the microservice architecture.
"""

import os
import json
from pydantic import BaseModel, Field
from typing import Optional
from app.core.config import GEMINI_API_KEY


def _extract_cv_text(file_path: str) -> str:
    """Extract text from a CV file (PDF or DOCX)."""
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        try:
            from PyPDF2 import PdfReader
            reader = PdfReader(file_path)
            return "\n".join(
                page.extract_text() or "" for page in reader.pages
            )
        except Exception as e:
            print(f"PyPDF2 error: {e}")
            return ""
    elif ext == ".docx":
        try:
            from docx import Document
            doc = Document(file_path)
            return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        except Exception as e:
            print(f"python-docx error: {e}")
            return ""
    return ""


class CVScreeningResult(BaseModel):
    full_name: str = Field(description="The full name of the candidate extracted from the CV.")
    email: Optional[str] = Field(None, description="The email address of the candidate. Return null if not found.")
    phone: Optional[str] = Field(None, description="The phone number of the candidate. Return null if not found.")
    ai_score: float = Field(description="An objective score from 0.0 to 100.0 representing how well the candidate's skills and experience match the job requirements.")
    ai_reasoning: str = Field(description="A 2-3 sentence professional justification explaining why they received this score, highlighting their strengths or missing requirements.")


def screen_candidate(
    cv_file_path: str,
    requirements: str | None = None,
    required_skills: str | None = None,
    description: str | None = None,
) -> CVScreeningResult:
    """
    Legacy inline screener — NOT CALLED in production.
    The microservice at ai_service/ handles screening via ai_client.py.
    """
    return CVScreeningResult(
        full_name=os.path.basename(cv_file_path).split('.')[0],
        email=None,
        phone=None,
        ai_score=0.0,
        ai_reasoning="This legacy screener is inactive. The ai_service/ microservice handles screening."
    )
