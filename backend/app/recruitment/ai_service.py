"""
AI Screening Service — Production-Ready Implementation using Google Gemini.

Uses gemini-1.5-flash to read raw CV text from a document and output Structured JSON
with the candidate's name, email, phone, relevance score (0-100), and reasoning.
"""

import os
import json
from google import genai
from google.genai import types
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
    Score a candidate's CV against a vacancy's requirements using Google Gemini.
    Returns structured data directly via python API.
    """
    cv_text = _extract_cv_text(cv_file_path)
    
    # If we truly can't parse text, return 0
    if not cv_text.strip():
        return CVScreeningResult(
            full_name=os.path.basename(cv_file_path).split('.')[0],
            email=None,
            phone=None,
            ai_score=0.0,
            ai_reasoning="Could not extract any readable text from the provided document file."
        )

    # Initialize Gemini client (key sourced from core/config)
    api_key = GEMINI_API_KEY
    if not api_key:
        print("WARNING: GEMINI_API_KEY is not configured. Failing safe.")
        return CVScreeningResult(
            full_name=os.path.basename(cv_file_path).split('.')[0],
            email=None,
            phone=None,
            ai_score=0.0,
            ai_reasoning="System Error: Missing AI API Key. Could not process."
        )

    try:
        client = genai.Client(api_key=api_key)
        
        prompt = f"""
        You are an expert HR Recruitment AI.
        Please evaluate the following candidate CV against the Job Description and Requirements.
        
        Job Description: {description or 'N/A'}
        Requirements: {requirements or 'N/A'}
        Required Skills: {required_skills or 'N/A'}
        
        Candidate CV Text:
        ---
        {cv_text[:15000]} # Cap at 15000 chars to avoid absurd context overloads for giant docs
        ---
        
        Extract their Name, Email, and Phone number.
        Evaluate their fit and assign an `ai_score` from 0.0 to 100.0. Focus heavily on actual, demonstrated experience overlapping with the requirements. Do not just count keyword matches.
        Provide a concise, 2-to-3 sentence `ai_reasoning` summarising your scoring logic, targeting HR professionals.
        """
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=CVScreeningResult,
                temperature=0.2, # Low temperature for analytical consistency
            ),
        )
        
        if response.text:
            data = json.loads(response.text)
            return CVScreeningResult(**data)
        
    except Exception as e:
        print(f"Gemini API Error: {e}")
        
    return CVScreeningResult(
        full_name=os.path.basename(cv_file_path).split('.')[0],
        email=None,
        phone=None,
        ai_score=0.0,
        ai_reasoning="AI Processing Failed due to an internal error or rate limit."
    )
