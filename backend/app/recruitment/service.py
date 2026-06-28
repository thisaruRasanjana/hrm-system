import logging
from datetime import datetime

from fastapi import BackgroundTasks, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.ai_client import screen_candidate as ai_screen
from app.core.email import (
    send_job_offer_email,
    send_rejection_email,
    send_scheduling_email,
)
from app.core.storage import save_file_locally
from app.database.database import SessionLocal
from . import models, schemas

logger = logging.getLogger(__name__)


# ── Candidate / Application Status Constants ──────────────────────────────────
# Centralised here so status strings are never scattered across the codebase.
# Any change to the status vocabulary only requires editing this section.
STATUS_UPLOADED             = "Uploaded"
STATUS_CALLED               = "Called"
STATUS_FIRST_ROUND          = "First Round"
STATUS_SECOND_ROUND_PENDING = "Second Round Pending"
STATUS_SECOND_ROUND         = "Second Round"
STATUS_JOB_OFFERED          = "Job Offered"
STATUS_REJECTED              = "Rejected"
STATUS_ACTIVE               = "Active"   # Vacancy status required for CV uploads

# Final decision vocabulary — must match the frontend dropdown values.
DECISION_NEXT_ROUND  = "Proceed to Next Round"
DECISION_JOB_OFFERED = "Job Offered"
DECISION_REJECTED    = "Rejected"

# Maps each final decision to the resulting application status.
DECISION_STATUS_MAP: dict[str, str] = {
    DECISION_NEXT_ROUND:  STATUS_SECOND_ROUND,
    DECISION_JOB_OFFERED: STATUS_JOB_OFFERED,
    DECISION_REJECTED:    STATUS_REJECTED,
}

# Evaluation scoring: 5 dimensions × max 5 points each = 25 total.
# Dividing by this constant and multiplying by 100 normalises to a 0–100 scale.
EVALUATION_MAX_TOTAL: int = 25


# ── Vacancy CRUD ───────────────────────────────────────────────────────────────

def create_vacancy(db: Session, vacancy_data: schemas.VacancyCreate) -> dict:
    """
    Persist a new vacancy and return it with an initial applicant count of 0.
    Uses model_dump() (Pydantic v2) instead of the deprecated .dict().
    """
    try:
        vacancy = models.Vacancy(**vacancy_data.model_dump())
        db.add(vacancy)
        db.commit()
        db.refresh(vacancy)
        return {**vacancy.__dict__, "applicants": 0}
    except Exception as exc:
        db.rollback()
        logger.error("Failed to create vacancy: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to create vacancy.") from exc


def get_all_vacancies(db: Session):
    vacancies = db.query(models.Vacancy).all()
    result = []
    for v in vacancies:
        count = (
            db.query(func.count(models.Application.id))
            .filter(models.Application.vacancy_id == v.id)
            .scalar()
        )
        result.append({**v.__dict__, "applicants": count})
    return result


def get_vacancy_by_id(db: Session, vacancy_id: int):
    vacancy = (
        db.query(models.Vacancy)
        .filter(models.Vacancy.id == vacancy_id)
        .first()
    )
    if not vacancy:
        return None
    count = (
        db.query(func.count(models.Application.id))
        .filter(models.Application.vacancy_id == vacancy.id)
        .scalar()
    )
    return {**vacancy.__dict__, "applicants": count}


def update_vacancy(db: Session, vacancy_id: int, data: schemas.VacancyUpdate):
    vacancy = (
        db.query(models.Vacancy)
        .filter(models.Vacancy.id == vacancy_id)
        .first()
    )
    if not vacancy:
        return None
    if data.description is not None:
        vacancy.description = data.description
    if data.requirements is not None:
        vacancy.requirements = data.requirements
    if data.required_skills is not None:
        vacancy.required_skills = data.required_skills
    if data.status is not None:
        vacancy.status = data.status
    db.commit()
    db.refresh(vacancy)
    return vacancy


def delete_vacancy(db: Session, vacancy_id: int):
    vacancy = (
        db.query(models.Vacancy)
        .filter(models.Vacancy.id == vacancy_id)
        .first()
    )
    if not vacancy:
        return False
    db.delete(vacancy)
    db.commit()
    return True


# ── CV Upload & Background AI Processing ──────────────────────────────────────

def process_cv_background(candidate_id: int, vacancy_id: int, file_path: str):
    """Request AI screening for a single CV via the AI service HTTP API."""
    db = SessionLocal()
    try:
        vacancy = db.query(models.Vacancy).filter(models.Vacancy.id == vacancy_id).first()
        if not vacancy:
            return

        result = ai_screen(
            cv_file_path=file_path,
            title=vacancy.title,
            experience_level=vacancy.experience_level,
            description=vacancy.description,
            requirements=vacancy.requirements,
        )

        candidate = db.query(models.Candidate).filter(models.Candidate.id == candidate_id).first()
        if candidate:
            if result.full_name and result.full_name.strip():
                candidate.full_name = result.full_name
            # Only fill in email if the candidate did NOT already provide one.
            # Public portal candidates may have typed their email — preserve it.
            if not _has_valid_email(candidate.email):
                candidate.email = result.email
            candidate.phone = result.phone
            candidate.ai_score = result.ai_score
            candidate.ai_reasoning = result.ai_reasoning
            db.commit()

            # ── Notify HR ────────────────────────────────────────────────
            try:
                from app.notifications.service import notify_permission
                notify_permission(
                    db, "recruitment:manage",
                    f"AI screening completed for {candidate.full_name} ({vacancy.title})",
                    category="recruitment", type="info", link=f"/recruitment/{vacancy.id}",
                    entity_type="candidate", entity_id=str(candidate.id),
                )
                db.commit()
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"[Recruitment] Notification failed for AI screen: {e}")
    except Exception as exc:
        db.rollback()
        logger.error(
            "Background CV processing failed for candidate %d: %s",
            candidate_id,
            exc,
        )
    finally:
        db.close()


def upload_cvs(
    db: Session,
    vacancy_id: int,
    files: list[UploadFile],
    background_tasks: BackgroundTasks,
):
    vacancy = db.query(models.Vacancy).filter(models.Vacancy.id == vacancy_id).first()
    if not vacancy:
        raise HTTPException(status_code=404, detail="Vacancy not found.")
    # Only Active vacancies accept new CVs — Draft and Closed are locked.
    if vacancy.status != STATUS_ACTIVE:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot upload CVs to a vacancy in '{vacancy.status}' status. "
                f"Set the vacancy to '{STATUS_ACTIVE}' first."
            ),
        )

    successful = 0
    failed = 0

    for file in files:
        try:
            if not file.filename.lower().endswith((".pdf", ".docx")):
                failed += 1
                continue

            file_path = save_file_locally(file)

            # Use filename (without extension) as a temporary name until AI overwrites it.
            filename_base = file.filename.rsplit(".", 1)[0]

            # Duplicate check: same filename already applied to this vacancy
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
                failed += 1
                continue

            # Create candidate with "Uploaded" status (spec §1.2.5)
            candidate = models.Candidate(
                full_name=filename_base,
                email="Processing...",
                phone="Processing...",
                cv_file_path=file_path,
                uploaded_at=datetime.utcnow(),
            )
            db.add(candidate)
            db.flush()

            application = models.Application(
                vacancy_id=vacancy_id,
                candidate_id=candidate.id,
                status=STATUS_UPLOADED,   # ← was "Not Called"
            )
            db.add(application)
            db.commit()

            # AI screening runs automatically in the background (spec §1.3.1)
            background_tasks.add_task(
                process_cv_background, candidate.id, vacancy_id, file_path
            )
            successful += 1

        except Exception as exc:
            db.rollback()
            logger.error("CV upload error for file '%s': %s", file.filename, exc)
            failed += 1

    return {
        "successful_uploads": successful,
        "failed_uploads": failed,
        "message": "Upload completed. CVs are being processed by AI in the background.",
    }


# ── Candidate Queries ─────────────────────────────────────────────────────────

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
                models.Application.vacancy_id == vacancy_id,
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
            "cv_file_path": c.cv_file_path,
        })
    return result


def get_candidate_profile(db: Session, candidate_id: int):
    candidate = (
        db.query(models.Candidate)
        .filter(models.Candidate.id == candidate_id)
        .first()
    )
    if not candidate:
        return None

    application = (
        db.query(models.Application)
        .filter(models.Application.candidate_id == candidate_id)
        .first()
    )
    return {
        "id": candidate.id,
        "full_name": candidate.full_name,
        "phone": candidate.phone,
        "email": candidate.email,
        "ai_score": candidate.ai_score,
        "ai_reasoning": candidate.ai_reasoning,
        "cv_file_path": candidate.cv_file_path,
        "application_id": application.id if application else None,
        "status": application.status if application else None,
        "notes": application.notes if application else None,
    }


# ── Application Updates ───────────────────────────────────────────────────────

def update_application_notes(db: Session, application_id: int, data: schemas.ApplicationUpdate):
    """Save call notes and automatically advance status to 'Called' (spec §1.4.1)."""
    application = (
        db.query(models.Application)
        .filter(models.Application.id == application_id)
        .first()
    )
    if not application:
        return None

    application.notes = data.notes
    # Auto-set status to "Called" — the spec says this should be automatic,
    # not a manual dropdown choice.
    application.status = STATUS_CALLED

    db.commit()
    db.refresh(application)
    return application


# ── Interview Panel ───────────────────────────────────────────────────────────

def upsert_interview_panel(db: Session, vacancy_id: int, data: schemas.InterviewPanelCreate):
    """Create panel if it doesn't exist, or update it if it does."""
    vacancy = (
        db.query(models.Vacancy)
        .filter(models.Vacancy.id == vacancy_id)
        .first()
    )
    if not vacancy:
        raise HTTPException(status_code=404, detail="Vacancy not found")

    # panel_head_id is required — interview link can be added later via edit
    if not data.panel_head_id:
        raise HTTPException(
            status_code=422,
            detail="Panel Head is required. Please select a Panel Head before saving.",
        )

    panel = (
        db.query(models.InterviewPanel)
        .filter(models.InterviewPanel.vacancy_id == vacancy_id)
        .first()
    )
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
            interview_link=data.interview_link,
        )
        db.add(panel)

    db.commit()
    db.refresh(panel)
    return panel


def get_interview_panel(db: Session, vacancy_id: int):
    return (
        db.query(models.InterviewPanel)
        .filter(models.InterviewPanel.vacancy_id == vacancy_id)
        .first()
    )


# ── Helper ────────────────────────────────────────────────────────────────────

def _has_valid_email(email: str | None) -> bool:
    """Return True only when the string looks like a real email address."""
    if not email:
        return False
    skip = {"Processing...", "placeholder@email.com", ""}
    return email.strip() not in skip and "@" in email


async def send_scheduling_link(db: Session, application_id: int):
    application = (
        db.query(models.Application)
        .filter(models.Application.id == application_id)
        .first()
    )
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    candidate = (
        db.query(models.Candidate)
        .filter(models.Candidate.id == application.candidate_id)
        .first()
    )
    vacancy = (
        db.query(models.Vacancy)
        .filter(models.Vacancy.id == application.vacancy_id)
        .first()
    )
    panel = (
        db.query(models.InterviewPanel)
        .filter(models.InterviewPanel.vacancy_id == application.vacancy_id)
        .first()
    )

    if not panel or not panel.interview_link:
        raise HTTPException(
            status_code=400,
            detail="Interview panel or scheduling link not configured for this vacancy.",
        )

    # Require a real email — never silently fall back to a placeholder
    if not _has_valid_email(candidate.email):
        raise HTTPException(
            status_code=400,
            detail="NO_EMAIL",
        )

    try:
        await send_scheduling_email(
            to=candidate.email,
            candidate_name=candidate.full_name,
            job_title=vacancy.title,
            interview_link=panel.interview_link,
        )
    except Exception as e:
        print("EMAIL ERROR:", e)
        raise HTTPException(status_code=500, detail="Failed to send scheduling email.")

    # Update status to unlock evaluations for the respective round
    if application.status == STATUS_CALLED:
        application.status = STATUS_FIRST_ROUND
    elif application.status == STATUS_SECOND_ROUND_PENDING:
        application.status = STATUS_SECOND_ROUND
    db.commit()

    return {"message": "Scheduling link sent successfully"}


# ── Candidate Updates ─────────────────────────────────────────────────────────

def update_candidate_details(db: Session, candidate_id: int, data: schemas.CandidateUpdate):
    """Allow HR to manually update candidate details."""
    candidate = (
        db.query(models.Candidate)
        .filter(models.Candidate.id == candidate_id)
        .first()
    )
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    if data.full_name is not None:
        candidate.full_name = data.full_name.strip()
    if data.phone is not None:
        candidate.phone = data.phone.strip()
    if data.email is not None:
        candidate.email = data.email.strip()
        
    db.commit()
    db.refresh(candidate)
    return candidate


# ── Interview Evaluations ─────────────────────────────────────────────────────

def create_evaluation(db: Session, application_id: int, data: schemas.EvaluationCreate):
    application = (
        db.query(models.Application)
        .filter(models.Application.id == application_id)
        .first()
    )
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # Prevent duplicate submission: same evaluator, same round
    if data.evaluator_name:
        duplicate = (
            db.query(models.InterviewEvaluation)
            .filter(
                models.InterviewEvaluation.application_id == application_id,
                models.InterviewEvaluation.round_number == data.round_number,
                models.InterviewEvaluation.evaluator_name == data.evaluator_name,
            )
            .first()
        )
        if duplicate:
            raise HTTPException(
                status_code=400,
                detail="You have already submitted an evaluation for this round.",
            )

    # Normalise: sum of 5 dimensions (max EVALUATION_MAX_TOTAL) → 0–100 scale.
    raw_total = (
        data.technical_skills
        + data.problem_solving
        + data.communication
        + data.cultural_fit
        + data.attitude
    )
    overall_score = (raw_total / EVALUATION_MAX_TOTAL) * 100.0

    evaluation = models.InterviewEvaluation(
        application_id=application_id,
        round_number=data.round_number,     # ← from client, not auto-incremented
        technical_skills=data.technical_skills,
        problem_solving=data.problem_solving,
        communication=data.communication,
        cultural_fit=data.cultural_fit,
        attitude=data.attitude,
        overall_score=overall_score,
        comments=data.comments,
        needs_another_round=data.needs_another_round,
        evaluator_name=data.evaluator_name,
    )
    db.add(evaluation)

    # Advance application status based on the round number (spec §4 status progression)
    if data.round_number == 1:
        application.status = STATUS_FIRST_ROUND
    else:
        application.status = STATUS_SECOND_ROUND

    try:
        db.commit()
        db.refresh(evaluation)

        # ── Notify Panel Head ──────────────────────────────────────────
        try:
            from app.notifications.service import notify_user
            panel = db.query(models.InterviewPanel).filter(models.InterviewPanel.vacancy_id == application.vacancy_id).first()
            if panel and panel.panel_head_id:
                notify_user(
                    db, panel.panel_head_id,
                    f"New evaluation submitted by {data.evaluator_name}",
                    category="recruitment", type="info", link=f"/recruitment/{application.vacancy_id}",
                    entity_type="application", entity_id=str(application_id),
                )
                db.commit()
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"[Recruitment] Notification failed for evaluation: {e}")

    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to save evaluation.")

    return evaluation


def get_evaluations(db: Session, application_id: int):
    return (
        db.query(models.InterviewEvaluation)
        .filter(models.InterviewEvaluation.application_id == application_id)
        .order_by(models.InterviewEvaluation.round_number.asc())
        .all()
    )


# ── Final Decision ────────────────────────────────────────────────────────────

def get_final_decision_view(db: Session, application_id: int):
    """Aggregate all evaluations + candidate/vacancy info for the panel head decision page."""
    application = (
        db.query(models.Application)
        .filter(models.Application.id == application_id)
        .first()
    )
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == application.candidate_id
    ).first()
    vacancy = db.query(models.Vacancy).filter(
        models.Vacancy.id == application.vacancy_id
    ).first()
    evaluations = (
        db.query(models.InterviewEvaluation)
        .filter(models.InterviewEvaluation.application_id == application_id)
        .order_by(models.InterviewEvaluation.round_number.asc())
        .all()
    )

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
    panel_avg = (
        round(sum(e.overall_score for e in evaluations) / len(evaluations), 1)
        if evaluations
        else 0.0
    )

    existing_decision = (
        db.query(models.FinalDecision)
        .filter(models.FinalDecision.application_id == application_id)
        .first()
    )

    return {
        "candidate": {
            "id": candidate.id,
            "full_name": candidate.full_name,
            "phone": candidate.phone,
            "email": candidate.email,
        },
        "vacancy": {"id": vacancy.id, "title": vacancy.title},
        "evaluations": evaluations,
        "category_averages": category_averages,
        "panel_avg_score": panel_avg,
        "evaluator_count": len(evaluations),
        "final_decision": existing_decision,
        "application_id": application_id,
    }


async def submit_final_decision(db: Session, application_id: int, data: schemas.FinalDecisionCreate):
    """Record the panel head's final decision, update status, and email the candidate."""
    allowed = {DECISION_NEXT_ROUND, DECISION_JOB_OFFERED, DECISION_REJECTED}
    if data.decision not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid decision. Must be one of: {', '.join(allowed)}",
        )

    existing = (
        db.query(models.FinalDecision)
        .filter(models.FinalDecision.application_id == application_id)
        .first()
    )

    new_status = DECISION_STATUS_MAP[data.decision]

    if existing:
        existing.decision = data.decision
        existing.notes = data.notes
        existing.decided_at = datetime.utcnow()
    else:
        existing = models.FinalDecision(
            application_id=application_id,
            decision=data.decision,
            notes=data.notes,
        )
        db.add(existing)

    # Sync application status with the decision outcome
    application = (
        db.query(models.Application)
        .filter(models.Application.id == application_id)
        .first()
    )
    if application:
        application.status = new_status

    db.commit()
    db.refresh(existing)

    # ── Notify HR ────────────────────────────────────────────────────
    try:
        from app.notifications.service import notify_permission
        notify_permission(
            db, "recruitment:manage",
            f"Final decision made for application #{application_id}: {data.decision}",
            category="recruitment", type="info", link=f"/recruitment/{application.vacancy_id}",
            entity_type="application", entity_id=str(application_id),
        )
        db.commit()
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"[Recruitment] Notification failed for decision: {e}")

    # ── Send outcome email to the candidate ───────────────────────────────────
    try:
        candidate = db.query(models.Candidate).filter(models.Candidate.id == application.candidate_id).first()
        vacancy = db.query(models.Vacancy).filter(models.Vacancy.id == application.vacancy_id).first()
        panel = db.query(models.InterviewPanel).filter(models.InterviewPanel.vacancy_id == application.vacancy_id).first()

        if candidate and vacancy and _has_valid_email(candidate.email):
            if data.decision == DECISION_JOB_OFFERED:
                await send_job_offer_email(
                    to=candidate.email, 
                    candidate_name=candidate.full_name,
                    job_title=vacancy.title,
                )
            elif data.decision == DECISION_REJECTED:
                await send_rejection_email(
                    to=candidate.email,
                    candidate_name=candidate.full_name,
                    job_title=vacancy.title,
                )
            elif data.decision == DECISION_NEXT_ROUND and panel and panel.interview_link:
                # Automatically send the next-round scheduling email
                await send_scheduling_email(
                    to=candidate.email,
                    candidate_name=candidate.full_name,
                    job_title=vacancy.title,
                    interview_link=panel.interview_link,
                )
    except Exception as exc:
        # Email failure is non-fatal — the decision is already saved.
        # Log the error so it can be investigated without breaking the workflow.
        logger.error("Outcome email failed for application %d: %s", application_id, exc)

    return existing


def trigger_next_round(db: Session, application_id: int):
    """
    Called when panel head selects 'Proceed to Next Round'.
    Updates the application status to Second Round.
    The next evaluation submission will use round_number = current_max + 1.
    The evaluate page already computes round_number from max(existing evaluations) + 1,
    so no DB field needs to change — the round auto-increments on next evaluation save.
    """
    application = (
        db.query(models.Application)
        .filter(models.Application.id == application_id)
        .first()
    )
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    application.status = STATUS_SECOND_ROUND
    
    # Delete the final decision record since it was only meant for the previous round
    db.query(models.FinalDecision).filter(models.FinalDecision.application_id == application_id).delete()
    
    db.commit()

    # ── Notify HR ────────────────────────────────────────────────────
    try:
        from app.notifications.service import notify_permission
        vacancy = db.query(models.Vacancy).filter(models.Vacancy.id == application.vacancy_id).first()
        vacancy_title = vacancy.title if vacancy else "vacancy"
        notify_permission(
            db, "recruitment:manage",
            f"Application #{application_id} ({vacancy_title}) was advanced to the next round",
            category="recruitment", type="info", link=f"/recruitment/{application.vacancy_id}",
            entity_type="application", entity_id=str(application_id),
        )
        db.commit()
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"[Recruitment] Notification failed for next round: {e}")
    return {"message": "Application advanced to next round"}


# ── Evaluated Candidates Summary ──────────────────────────────────────────────

def get_evaluated_candidates(db: Session, vacancy_id: int):
    """Return candidates with at least one evaluation, ranked by average score."""
    applications = (
        db.query(models.Application)
        .filter(models.Application.vacancy_id == vacancy_id)
        .all()
    )

    results = []
    for app in applications:
        evals = (
            db.query(models.InterviewEvaluation)
            .filter(models.InterviewEvaluation.application_id == app.id)
            .all()
        )
        if not evals:
            continue

        candidate = (
            db.query(models.Candidate)
            .filter(models.Candidate.id == app.candidate_id)
            .first()
        )
        avg_score = round(sum(e.overall_score for e in evals) / len(evals), 1)
        final_dec = (
            db.query(models.FinalDecision)
            .filter(models.FinalDecision.application_id == app.id)
            .first()
        )

        results.append({
            "application_id": app.id,
            "candidate_id": candidate.id,
            "full_name": candidate.full_name,
            "phone": candidate.phone,
            "eval_count": len(evals),
            "avg_score": avg_score,
            "decision": final_dec.decision if final_dec else None,
            "status": app.status,
        })

    return sorted(results, key=lambda r: r["avg_score"], reverse=True)


# ── Re-run AI Screening ───────────────────────────────────────────────────────

def run_ai_screening(db: Session, vacancy_id: int):
    """Re-score all candidates for a vacancy via the AI screening service."""
    vacancy = db.query(models.Vacancy).filter(models.Vacancy.id == vacancy_id).first()
    if not vacancy:
        raise HTTPException(status_code=404, detail="Vacancy not found")

    applications = (
        db.query(models.Application)
        .filter(models.Application.vacancy_id == vacancy_id)
        .all()
    )

    scored = 0
    for app in applications:
        candidate = (
            db.query(models.Candidate)
            .filter(models.Candidate.id == app.candidate_id)
            .first()
        )
        if not candidate or not candidate.cv_file_path:
            continue

        try:
            result = ai_screen(
                cv_file_path=candidate.cv_file_path,
                title=vacancy.title,
                experience_level=vacancy.experience_level,
                description=vacancy.description,
                requirements=vacancy.requirements,
            )
            candidate.ai_score = result.ai_score
            candidate.ai_reasoning = result.ai_reasoning
            scored += 1
        except Exception as exc:
            logger.error("AI re-score failed for candidate %d: %s", candidate.id, exc)

    db.commit()
    return {"scored": scored, "total": len(applications)}