from sqlalchemy.orm import Session
from sqlalchemy import func
from . import models, schemas
from fastapi import UploadFile, HTTPException
from app.core.storage import save_file_locally
from app.core.email import send_scheduling_email
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

    vacancy = db.query(models.Vacancy).filter(models.Vacancy.id == vacancy_id).first()
    if not vacancy:
        raise HTTPException(status_code=404, detail="Vacancy not found")
    if vacancy.status != "Active":
        raise HTTPException(status_code=400, detail=f"Cannot upload CVs to a vacancy in '{vacancy.status}' status. Must be 'Active'.")

    successful = 0
    failed = 0

    for file in files:

        try:
            if not file.filename.lower().endswith((".pdf", ".docx")):
                failed += 1
                continue
                
            candidate_name = file.filename.split(".")[0]
            
            existing = db.query(models.Application).join(models.Candidate).filter(
                models.Application.vacancy_id == vacancy_id,
                models.Candidate.full_name == candidate_name
            ).first()
            
            if existing:
                failed += 1
                continue

            file_path = save_file_locally(file)

            candidate = models.Candidate(
                full_name=candidate_name,
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
            db.rollback()
            print("UPLOAD ERROR:", e)
            failed += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print("FINAL COMMIT ERROR:", e)

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
    if getattr(data, 'required_skills', None) is not None:
        vacancy.required_skills = data.required_skills
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


async def send_scheduling_link(db: Session, application_id: int):
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    candidate = db.query(models.Candidate).filter(models.Candidate.id == application.candidate_id).first()
    vacancy = db.query(models.Vacancy).filter(models.Vacancy.id == application.vacancy_id).first()
    
    panel = db.query(models.InterviewPanel).filter(models.InterviewPanel.vacancy_id == application.vacancy_id).first()
    
    if not panel or not panel.interview_link:
        raise HTTPException(status_code=400, detail="Interview panel or link not configured for this vacancy")
        
    candidate_email = candidate.email or "placeholder@email.com"
    
    try:
        await send_scheduling_email(
            to=candidate_email,
            candidate_name=candidate.full_name,
            job_title=vacancy.title,
            interview_link=panel.interview_link
        )
    except Exception as e:
        print("EMAIL ERROR:", e)
        raise HTTPException(status_code=500, detail="Failed to send email")

    return {"message": "Scheduling link sent successfully"}


def create_evaluation(db: Session, application_id: int, data: schemas.EvaluationCreate):
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
        
    # Calculate overall score out of 25 (5 attributes * 5 max points)
    total_score = data.technical_skills + data.problem_solving + data.communication + data.cultural_fit + data.attitude
    overall_score = (total_score / 25.0) * 100.0
    
    # Calculate round number based on existing evaluations
    existing_evals = db.query(models.InterviewEvaluation).filter(models.InterviewEvaluation.application_id == application_id).count()
    round_number = existing_evals + 1
    
    evaluation = models.InterviewEvaluation(
        application_id=application_id,
        round_number=round_number,
        technical_skills=data.technical_skills,
        problem_solving=data.problem_solving,
        communication=data.communication,
        cultural_fit=data.cultural_fit,
        attitude=data.attitude,
        overall_score=overall_score,
        comments=data.comments,
        needs_another_round=data.needs_another_round,
        evaluator_name=data.evaluator_name if hasattr(data, 'evaluator_name') else None
    )
    db.add(evaluation)
    
    # Auto-update the application pipeline status
    if data.needs_another_round:
        application.status = "Another Round Needed"
    else:
        application.status = "Evaluated"
    
    try:
        db.commit()
        db.refresh(evaluation)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to save evaluation due to database error.")
    
    return evaluation


def get_evaluations(db: Session, application_id: int):
    return db.query(models.InterviewEvaluation).filter(models.InterviewEvaluation.application_id == application_id).order_by(models.InterviewEvaluation.round_number.asc()).all()


def get_final_decision_view(db: Session, application_id: int):
    """Aggregate all evaluations+ candidate/vacancy info for the panel head final decision page."""
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    candidate = db.query(models.Candidate).filter(models.Candidate.id == application.candidate_id).first()
    vacancy = db.query(models.Vacancy).filter(models.Vacancy.id == application.vacancy_id).first()
    evaluations = db.query(models.InterviewEvaluation).filter(
        models.InterviewEvaluation.application_id == application_id
    ).order_by(models.InterviewEvaluation.round_number.asc()).all()

    # Compute per-category averages
    def avg(attr):
        vals = [getattr(e, attr) for e in evaluations if getattr(e, attr, 0) > 0]
        return round(sum(vals) / len(vals), 1) if vals else 0.0

    category_averages = {
        "technical_skills": avg("technical_skills"),
        "problem_solving": avg("problem_solving"),
        "communication": avg("communication"),
        "cultural_fit": avg("cultural_fit"),
        "attitude": avg("attitude"),
    }

    panel_avg = round(sum(e.overall_score for e in evaluations) / len(evaluations), 1) if evaluations else 0.0

    # Existing final decision if any
    existing_decision = db.query(models.FinalDecision).filter(
        models.FinalDecision.application_id == application_id
    ).first()

    return {
        "candidate": {"id": candidate.id, "full_name": candidate.full_name, "phone": candidate.phone, "email": candidate.email},
        "vacancy": {"id": vacancy.id, "title": vacancy.title},
        "evaluations": evaluations,
        "category_averages": category_averages,
        "panel_avg_score": panel_avg,
        "evaluator_count": len(evaluations),
        "final_decision": existing_decision,
        "application_id": application_id,
    }


def submit_final_decision(db: Session, application_id: int, data: schemas.FinalDecisionCreate):
    existing = db.query(models.FinalDecision).filter(models.FinalDecision.application_id == application_id).first()
    if existing:
        existing.decision = data.decision
        existing.notes = data.notes
        existing.decided_at = datetime.utcnow()
        
        # Also sync application status
        application = db.query(models.Application).filter(models.Application.id == application_id).first()
        if application:
            application.status = data.decision
        
        db.commit()
        db.refresh(existing)
        return existing

    decision = models.FinalDecision(
        application_id=application_id,
        decision=data.decision,
        notes=data.notes,
    )
    db.add(decision)
    
    # Sync application status with the decision
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if application:
        application.status = data.decision  # Selected | Rejected | Keep for Future
    
    db.commit()
    db.refresh(decision)
    return decision


def get_evaluated_candidates(db: Session, vacancy_id: int):
    """Return candidates for a vacancy who have at least one evaluation, with avg score + final decision."""
    from sqlalchemy import distinct
    applications = db.query(models.Application).filter(models.Application.vacancy_id == vacancy_id).all()

    results = []
    for app in applications:
        evals = db.query(models.InterviewEvaluation).filter(
            models.InterviewEvaluation.application_id == app.id
        ).all()
        if not evals:
            continue

        candidate = db.query(models.Candidate).filter(models.Candidate.id == app.candidate_id).first()
        avg_score = round(sum(e.overall_score for e in evals) / len(evals), 1)
        final_dec = db.query(models.FinalDecision).filter(models.FinalDecision.application_id == app.id).first()

        results.append({
            "application_id": app.id,
            "candidate_id": candidate.id,
            "full_name": candidate.full_name,
            "phone": candidate.phone,
            "eval_count": len(evals),
            "avg_score": avg_score,
            "decision": final_dec.decision if final_dec else None,
        })

    return sorted(results, key=lambda r: r["avg_score"], reverse=True)