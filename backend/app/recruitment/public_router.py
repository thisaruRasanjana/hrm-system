"""
Public Job Portal Router

Unauthenticated endpoints — intentionally separate from /recruitment.
Used by external candidates via shareable links.

Only Active vacancies are exposed. Draft and Closed vacancies return 404
so candidates never see internal or expired postings.
"""

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from app.database.deps import get_db
from app.recruitment import models, schemas, service
from app.recruitment.service import STATUS_ACTIVE
from app.core.storage import save_file_locally

router = APIRouter(prefix="/public", tags=["Public Job Portal"])


@router.get("/jobs/{vacancy_id}", response_model=schemas.PublicVacancyResponse)
def get_public_job(vacancy_id: int, db: Session = Depends(get_db)):
    """
    Return public-safe vacancy details for Active postings only.
    Called by the candidate-facing job page — no auth required.
    """
    vacancy = (
        db.query(models.Vacancy)
        .filter(models.Vacancy.id == vacancy_id, models.Vacancy.status == STATUS_ACTIVE)
        .first()
    )
    if not vacancy:
        raise HTTPException(
            status_code=404,
            detail="This position is not currently accepting applications.",
        )
    return vacancy


@router.post("/jobs/{vacancy_id}/apply")
def apply_for_job(
    vacancy_id: int,
    background_tasks: BackgroundTasks,
    cv_file: UploadFile = File(...),
    applicant_email: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """
    Accept a CV upload from a public candidate.

    - Validates the vacancy is still Active
    - Validates file type (PDF / DOCX only) and size (max 5 MB)
    - Creates a Candidate + Application record with status 'Uploaded'
    - Queues AI screening as a background task (same pipeline as internal uploads)
    """
    # Guard: vacancy must be Active — only Active vacancies accept new applications.
    vacancy = (
        db.query(models.Vacancy)
        .filter(models.Vacancy.id == vacancy_id, models.Vacancy.status == STATUS_ACTIVE)
        .first()
    )
    if not vacancy:
        raise HTTPException(
            status_code=404,
            detail="This position is not currently accepting applications.",
        )

    # Guard: file type
    if not cv_file.filename.lower().endswith((".pdf", ".docx")):
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are accepted.")

    # Guard: file size (5 MB max — read content once and check)
    content = cv_file.file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File size must be under 5 MB.")
    cv_file.file.seek(0)  # reset so storage can read it

    filename_base = cv_file.filename.rsplit(".", 1)[0]

    # Guard: duplicate application (same filename for same vacancy)
    existing = (
        db.query(models.Application)
        .join(models.Candidate)
        .filter(
            models.Application.vacancy_id == vacancy_id,
            models.Candidate.full_name == filename_base,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail="An application with this file name has already been submitted for this position.",
        )

    # Save file to disk
    file_path = save_file_locally(cv_file)

    # Create candidate record — AI will enrich name/email/phone in background
    candidate = models.Candidate(
        full_name=filename_base,
        email=applicant_email or None,
        phone=None,
        cv_file_path=file_path,
        uploaded_at=datetime.utcnow(),
    )
    db.add(candidate)
    db.flush()

    application = models.Application(
        vacancy_id=vacancy_id,
        candidate_id=candidate.id,
        status=service.STATUS_UPLOADED,
    )
    db.add(application)

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to save application. Please try again.",
        ) from exc

    # Queue AI screening — same background pipeline as internal CV uploads
    background_tasks.add_task(
        service.process_cv_background,
        candidate.id,
        vacancy_id,
        file_path,
    )

    return {
        "message": "Your application has been received. We'll be in touch soon.",
        "application_id": application.id,
    }
