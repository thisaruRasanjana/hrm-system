import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.database.deps import get_db
from app.recruitment import models
from . import schemas, service

router = APIRouter(prefix="/recruitment", tags=["Recruitment"])


# ── Vacancy Endpoints ─────────────────────────────────────────────────────────

@router.post("/vacancies", response_model=schemas.VacancyResponse)
def create_vacancy(vacancy: schemas.VacancyCreate, db: Session = Depends(get_db)):
    return service.create_vacancy(db, vacancy)


@router.get("/vacancies", response_model=list[schemas.VacancyResponse])
def list_vacancies(db: Session = Depends(get_db)):
    return service.get_all_vacancies(db)


@router.get("/vacancies/{vacancy_id}", response_model=schemas.VacancyResponse)
def get_vacancy(vacancy_id: int, db: Session = Depends(get_db)):
    vacancy = service.get_vacancy_by_id(db, vacancy_id)
    if not vacancy:
        raise HTTPException(status_code=404, detail="Vacancy not found")
    return vacancy


@router.patch("/vacancies/{vacancy_id}", response_model=schemas.VacancyResponse)
def update_vacancy(
    vacancy_id: int,
    data: schemas.VacancyUpdate,
    db: Session = Depends(get_db),
):
    vacancy = service.update_vacancy(db, vacancy_id, data)
    if not vacancy:
        raise HTTPException(status_code=404, detail="Vacancy not found")
    return service.get_vacancy_by_id(db, vacancy_id)


@router.delete("/vacancies/{vacancy_id}")
def delete_vacancy(vacancy_id: int, db: Session = Depends(get_db)):
    success = service.delete_vacancy(db, vacancy_id)
    if not success:
        raise HTTPException(status_code=404, detail="Vacancy not found")
    return {"message": "Vacancy deleted successfully"}


# ── CV Upload ─────────────────────────────────────────────────────────────────

@router.post("/vacancies/{vacancy_id}/upload-cvs", response_model=schemas.UploadSummary)
def upload_cvs(
    vacancy_id: int,
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    return service.upload_cvs(db, vacancy_id, files, background_tasks)


# ── Candidate Endpoints ───────────────────────────────────────────────────────

@router.get("/vacancies/{vacancy_id}/candidates", response_model=list[schemas.CandidateResponse])
def list_candidates(vacancy_id: int, db: Session = Depends(get_db)):
    return service.get_candidates_by_vacancy(db, vacancy_id)


@router.get("/candidates/{candidate_id}")
def get_candidate(candidate_id: int, db: Session = Depends(get_db)):
    candidate = service.get_candidate_profile(db, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate


@router.patch("/candidates/{candidate_id}/details")
def update_candidate_details(
    candidate_id: int,
    data: schemas.CandidateUpdate,
    db: Session = Depends(get_db),
):
    """Allow HR to manually update candidate details."""
    return service.update_candidate_details(db, candidate_id, data)


# ── File Serving (replaces public static mount) ───────────────────────────────

@router.get("/files/{filename}")
def serve_file(filename: str):
    """
    Serve an uploaded CV file by its UUID filename.
    Returns with Content-Disposition: inline so PDFs embed in <iframe>.
    """
    import mimetypes
    from app.core.config import UPLOAD_DIR

    safe_name = os.path.basename(filename)

    if not safe_name or "/" in safe_name or ".." in safe_name:
        raise HTTPException(status_code=400, detail="Invalid filename.")

    file_path = os.path.abspath(os.path.join(UPLOAD_DIR, safe_name))
    upload_abs = os.path.abspath(UPLOAD_DIR)

    if not file_path.startswith(upload_abs + os.sep):
        raise HTTPException(status_code=400, detail="Access denied.")

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found.")

    mime, _ = mimetypes.guess_type(file_path)
    return FileResponse(
        file_path,
        media_type=mime or "application/octet-stream",
        headers={"Content-Disposition": "inline"},
    )


# ── Application Endpoints ─────────────────────────────────────────────────────

@router.patch("/applications/{application_id}")
def update_application(
    application_id: int,
    data: schemas.ApplicationUpdate,
    db: Session = Depends(get_db),
):
    """Save call notes; status is automatically set to 'Called'."""
    application = service.update_application_notes(db, application_id, data)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    return {"message": "Notes saved and status updated to Called"}


@router.get("/applications/{application_id}")
def get_application(application_id: int, db: Session = Depends(get_db)):
    application = (
        db.query(models.Application)
        .filter(models.Application.id == application_id)
        .first()
    )
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    return application


@router.post("/applications/{application_id}/send-scheduling-link")
async def send_scheduling_link(application_id: int, db: Session = Depends(get_db)):
    return await service.send_scheduling_link(db, application_id)


# ── Interview Panel Endpoints ─────────────────────────────────────────────────

@router.post("/vacancies/{vacancy_id}/panel", response_model=schemas.InterviewPanelResponse)
def upsert_panel(
    vacancy_id: int,
    data: schemas.InterviewPanelCreate,
    db: Session = Depends(get_db),
):
    return service.upsert_interview_panel(db, vacancy_id, data)


@router.get("/vacancies/{vacancy_id}/panel", response_model=schemas.InterviewPanelResponse)
def get_panel(vacancy_id: int, db: Session = Depends(get_db)):
    panel = service.get_interview_panel(db, vacancy_id)
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")
    return panel


# ── Evaluation Endpoints ──────────────────────────────────────────────────────

@router.post("/applications/{application_id}/evaluate", response_model=schemas.EvaluationResponse)
def submit_evaluation(
    application_id: int,
    data: schemas.EvaluationCreate,
    db: Session = Depends(get_db),
):
    return service.create_evaluation(db, application_id, data)


@router.get("/applications/{application_id}/evaluations", response_model=list[schemas.EvaluationResponse])
def get_evaluations(application_id: int, db: Session = Depends(get_db)):
    return service.get_evaluations(db, application_id)


# ── Final Decision Endpoints ──────────────────────────────────────────────────

@router.get("/applications/{application_id}/final-decision-view")
def get_final_decision_view(application_id: int, db: Session = Depends(get_db)):
    return service.get_final_decision_view(db, application_id)


@router.post("/applications/{application_id}/final-decision", response_model=schemas.FinalDecisionResponse)
async def submit_final_decision(
    application_id: int,
    data: schemas.FinalDecisionCreate,
    db: Session = Depends(get_db),
):
    return await service.submit_final_decision(db, application_id, data)


@router.post("/applications/{application_id}/next-round")
def trigger_next_round(application_id: int, db: Session = Depends(get_db)):
    """Panel head triggers another interview round. Increments round_number for future evaluations."""
    return service.trigger_next_round(db, application_id)


@router.get("/vacancies/{vacancy_id}/evaluated-candidates")
def get_evaluated_candidates(vacancy_id: int, db: Session = Depends(get_db)):
    return service.get_evaluated_candidates(db, vacancy_id)


@router.post("/vacancies/{vacancy_id}/run-ai-screening")
def run_ai_screening(vacancy_id: int, db: Session = Depends(get_db)):
    return service.run_ai_screening(db, vacancy_id)