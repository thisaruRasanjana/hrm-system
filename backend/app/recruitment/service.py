from sqlalchemy.orm import Session
from sqlalchemy import func
from . import models
from fastapi import UploadFile, HTTPException
from app.core.storage import save_file_locally
from datetime import datetime


def create_vacancy(db: Session, vacancy_data):

    vacancy = models.Vacancy(**vacancy_data.dict())

    db.add(vacancy)
    db.commit()
    db.refresh(vacancy)

    return {
        **vacancy.__dict__,
        "applicants": 0
    }


def get_all_vacancies(db: Session):

    vacancies = db.query(models.Vacancy).all()

    result = []

    for v in vacancies:

        applicants_count = (
            db.query(func.count(models.Application.id))
            .filter(models.Application.vacancy_id == v.id)
            .scalar()
        )

        result.append({
            **v.__dict__,
            "applicants": applicants_count
        })

    return result


def get_vacancy_by_id(db: Session, vacancy_id: int):

    vacancy = db.query(models.Vacancy)\
        .filter(models.Vacancy.id == vacancy_id)\
        .first()

    if not vacancy:
        return None

    applicants_count = (
        db.query(func.count(models.Application.id))
        .filter(models.Application.vacancy_id == vacancy.id)
        .scalar()
    )

    return {
        **vacancy.__dict__,
        "applicants": applicants_count
    }


def get_candidates_by_vacancy(db: Session, vacancy_id: int):

    candidates = (
        db.query(models.Candidate)
        .join(models.Application)
        .filter(models.Application.vacancy_id == vacancy_id)
        .all()
    )

    result = []

    for c in candidates:

        application = (
            db.query(models.Application)
            .filter(
                models.Application.candidate_id == c.id,
                models.Application.vacancy_id == vacancy_id
            )
            .first()
        )

        result.append({
            "id": c.id,
            "full_name": c.full_name,
            "phone": c.phone,
            "email": c.email,
            "status": application.status if application else None,
            "ai_score": c.ai_score,
            "cv_file_path": c.cv_file_path
        })

    return result


def upload_cvs(db: Session, vacancy_id: int, files: list[UploadFile]):

    successful = 0
    failed = 0

    for file in files:

        try:

            file_path = save_file_locally(file)

            candidate = models.Candidate(
                full_name=file.filename.split(".")[0],
                email="placeholder@email.com",
                phone="0000000000",
                cv_file_path=file_path,
                uploaded_at=datetime.utcnow()
            )

            db.add(candidate)
            db.flush()  # get candidate.id before commit

            application = models.Application(
                vacancy_id=vacancy_id,
                candidate_id=candidate.id,
                status="Not Called"
            )

            db.add(application)

            successful += 1

        except Exception as e:

            print("UPLOAD ERROR:", e)
            failed += 1

    db.commit()

    return {
        "successful_uploads": successful,
        "failed_uploads": failed,
        "message": "Upload completed"
    }


def update_application(db: Session, application_id: int, data):

    application = db.query(models.Application)\
        .filter(models.Application.id == application_id)\
        .first()

    if not application:
        return None

    application.status = data.status
    application.notes = data.notes

    db.commit()
    db.refresh(application)

    return application


def get_candidate_profile(db: Session, candidate_id: int):

    candidate = db.query(models.Candidate)\
        .filter(models.Candidate.id == candidate_id)\
        .first()

    if not candidate:
        return None

    application = db.query(models.Application)\
        .filter(models.Application.candidate_id == candidate_id)\
        .first()

    return {
        "id": candidate.id,
        "full_name": candidate.full_name,
        "phone": candidate.phone,
        "email": candidate.email,
        "ai_score": candidate.ai_score,
        "cv_file_path": candidate.cv_file_path,
        "application_id": application.id if application else None,
        "status": application.status if application else None,
        "notes": application.notes if application else None
    }


def create_interview_panel(db: Session, vacancy_id: int, data):

    vacancy = db.query(models.Vacancy)\
        .filter(models.Vacancy.id == vacancy_id)\
        .first()

    if not vacancy:
        raise HTTPException(status_code=404, detail="Vacancy not found")

    if not data.panel_head_id or not data.interview_link:
        raise HTTPException(
            status_code=400,
            detail="Panel head and interview link are required"
        )

    panel = models.InterviewPanel(
        vacancy_id=vacancy_id,
        panel_head_id=data.panel_head_id,
        panel_member_1_id=data.panel_member_1_id,
        panel_member_2_id=data.panel_member_2_id,
        interview_link=data.interview_link
    )

    db.add(panel)
    db.commit()
    db.refresh(panel)

    return panel


def get_interview_panel(db: Session, vacancy_id: int):

    return db.query(models.InterviewPanel)\
        .filter(models.InterviewPanel.vacancy_id == vacancy_id)\
        .first()


def update_vacancy(db: Session, vacancy_id: int, data):

    vacancy = db.query(models.Vacancy)\
        .filter(models.Vacancy.id == vacancy_id)\
        .first()

    if not vacancy:
        return None

    # Only patch the fields that were actually provided
    if data.description is not None:
        vacancy.description = data.description
    if data.requirements is not None:
        vacancy.requirements = data.requirements
    if data.status is not None:
        vacancy.status = data.status

    db.commit()
    db.refresh(vacancy)

    return vacancy


def upsert_interview_panel(db: Session, vacancy_id: int, data):
    """Create panel if it doesn't exist, or update it if it does."""

    panel = db.query(models.InterviewPanel)\
        .filter(models.InterviewPanel.vacancy_id == vacancy_id)\
        .first()

    if panel:
        panel.panel_head_id = data.panel_head_id
        panel.panel_member_1_id = data.panel_member_1_id
        panel.panel_member_2_id = data.panel_member_2_id
        panel.interview_link = data.interview_link
    else:
        panel = models.InterviewPanel(
            vacancy_id=vacancy_id,
            panel_head_id=data.panel_head_id,
            panel_member_1_id=data.panel_member_1_id,
            panel_member_2_id=data.panel_member_2_id,
            interview_link=data.interview_link
        )
        db.add(panel)

    db.commit()
    db.refresh(panel)

    return panel