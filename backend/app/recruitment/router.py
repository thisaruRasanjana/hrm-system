from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.database.deps import get_db
from app.recruitment import models
from . import schemas, service

router = APIRouter(prefix="/recruitment", tags=["Recruitment"])


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


@router.get("/vacancies/{vacancy_id}/candidates", response_model=list[schemas.CandidateResponse])
def list_candidates(vacancy_id: int, db: Session = Depends(get_db)):
    return service.get_candidates_by_vacancy(db, vacancy_id)


@router.post("/vacancies/{vacancy_id}/upload-cvs", response_model=schemas.UploadSummary)
def upload_cvs(
    vacancy_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db)
):

    vacancy = db.query(models.Vacancy)\
        .filter(models.Vacancy.id == vacancy_id)\
        .first()

    if not vacancy:
        raise HTTPException(status_code=404, detail="Vacancy not found")

    # Prevent uploads if vacancy closed
    if vacancy.status and vacancy.status.lower() == "closed":
        raise HTTPException(
            status_code=400,
            detail="This vacancy is closed and cannot accept CV uploads"
        )

    return service.upload_cvs(db, vacancy_id, files)


@router.patch("/applications/{application_id}")
def update_application(
    application_id: int,
    data: schemas.ApplicationUpdate,
    db: Session = Depends(get_db),
):
    application = service.update_application(db, application_id, data)

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    return {"message": "Updated successfully"}


@router.get("/applications/{application_id}")
def get_application(application_id: int, db: Session = Depends(get_db)):
    application = db.query(models.Application)\
        .filter(models.Application.id == application_id)\
        .first()

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    return application


@router.get("/candidates/{candidate_id}")
def get_candidate(candidate_id: int, db: Session = Depends(get_db)):

    candidate = service.get_candidate_profile(db, candidate_id)

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    return candidate


@router.post(
    "/vacancies/{vacancy_id}/panel",
    response_model=schemas.InterviewPanelResponse
)
def create_panel(
    vacancy_id: int,
    data: schemas.InterviewPanelCreate,
    db: Session = Depends(get_db)
):
    return service.upsert_interview_panel(db, vacancy_id, data)


@router.get(
    "/vacancies/{vacancy_id}/panel",
    response_model=schemas.InterviewPanelResponse
)
def get_panel(vacancy_id: int, db: Session = Depends(get_db)):

    panel = service.get_interview_panel(db, vacancy_id)

    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")

    return panel


@router.post("/applications/{application_id}/send-scheduling-link")
async def send_scheduling_link(application_id: int, db: Session = Depends(get_db)):
    return await service.send_scheduling_link(db, application_id)


@router.post("/applications/{application_id}/evaluate", response_model=schemas.EvaluationResponse)
def submit_evaluation(application_id: int, data: schemas.EvaluationCreate, db: Session = Depends(get_db)):
    return service.create_evaluation(db, application_id, data)


@router.get("/applications/{application_id}/evaluations", response_model=list[schemas.EvaluationResponse])
def get_evaluations(application_id: int, db: Session = Depends(get_db)):
    return service.get_evaluations(db, application_id)


@router.get("/applications/{application_id}/final-decision-view")
def get_final_decision_view(application_id: int, db: Session = Depends(get_db)):
    return service.get_final_decision_view(db, application_id)


@router.post("/applications/{application_id}/final-decision", response_model=schemas.FinalDecisionResponse)
def submit_final_decision(
    application_id: int,
    data: schemas.FinalDecisionCreate,
    db: Session = Depends(get_db)
):
    return service.submit_final_decision(db, application_id, data)


@router.get("/vacancies/{vacancy_id}/evaluated-candidates")
def get_evaluated_candidates(vacancy_id: int, db: Session = Depends(get_db)):
    return service.get_evaluated_candidates(db, vacancy_id)