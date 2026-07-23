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
from app.auth.models import User
from app.departments.models import Department
from app.roles.models import Permission, Role, role_permissions, user_roles

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


# ── Panel membership guard ──────────────────────────────────────────────────

def _get_vacancy_id_for_application(db: Session, application_id: int) -> int | None:
    """Return the vacancy_id for a given application, or None if not found."""
    app = db.query(models.Application).filter(models.Application.id == application_id).first()
    return app.vacancy_id if app else None


def _assert_panel_member(db: Session, vacancy_id: int, user: User) -> None:
    """
    Raises HTTP 403 if the calling user is not a panel member OR panel head
    for the given vacancy.

    Users with recruitment:manage are always allowed (HR/admins can act on any vacancy).
    Users with only recruitment:interview_panel must be explicitly on the vacancy's panel.

    This is the server-side enforcement of the frontend's panel-scoped UI guard.
    """
    # HR / admins with full manage permission bypass the membership check.
    user_perms = {p.permission_name for role in user.roles for p in role.permissions}
    if "recruitment:manage" in user_perms:
        return

    # For panel-only users, check they are either the panel head or a listed member.
    panel = (
        db.query(models.InterviewPanel)
        .filter(models.InterviewPanel.vacancy_id == vacancy_id)
        .first()
    )
    if not panel:
        raise HTTPException(
            status_code=403,
            detail="No interview panel has been set up for this vacancy yet.",
        )

    is_head   = (panel.panel_head_id == user.id)
    is_member = (
        db.query(models.InterviewPanelMember)
        .filter(
            models.InterviewPanelMember.panel_id == panel.id,
            models.InterviewPanelMember.user_id  == user.id,
        )
        .first()
    ) is not None

    if not (is_head or is_member):
        raise HTTPException(
            status_code=403,
            detail="You are not a member of the interview panel for this vacancy.",
        )


# ── Vacancy CRUD ───────────────────────────────────────────────────────────────

def create_vacancy(db: Session, vacancy_data: schemas.VacancyCreate) -> dict:
    """
    Persist a new vacancy and return it with an initial applicant count of 0.
    Uses model_dump() (Pydantic v2) instead of the deprecated .dict().
    """
    try:
        data_dict = vacancy_data.model_dump()
        dept_id = data_dict.get("department_id")
        
        # Look up the department to populate the legacy string column
        dept = db.query(Department).filter(Department.id == dept_id).first()
        if not dept:
            raise HTTPException(status_code=400, detail="Invalid department ID.")
            
        data_dict["department"] = dept.name
        
        vacancy = models.Vacancy(**data_dict)
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

        from app.core.storage_service import storage as _storage
        import os
        tmp_path = None
        try:
            # Resolve to a local path the AI screener can read
            tmp_path = _storage.abs_path(file_path)
            result = ai_screen(
                cv_file_path=tmp_path,
                title=vacancy.title,
                experience_level=vacancy.experience_level,
                description=vacancy.description,
                requirements=vacancy.requirements,
            )
        finally:
            from app.core.config import STORAGE_BACKEND
            if STORAGE_BACKEND == "s3" and tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)

        candidate = db.query(models.Candidate).filter(models.Candidate.id == candidate_id).first()
        if candidate:
            is_hr_upload = candidate.source == "hr_upload"

            # Only overwrite name if this was an HR bulk upload (where full_name is just the filename).
            if is_hr_upload and result.full_name and result.full_name.strip():
                candidate.full_name = result.full_name

            # Only fill in email if not already set (public candidates always have one).
            if not _has_valid_email(candidate.email):
                candidate.email = result.email  # may be None — frontend shows "Not provided"

            # Only fill in phone if not already set (public candidates may have provided one).
            if not candidate.phone:
                candidate.phone = result.phone if result.phone else "Not provided"
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

            # ── Read file bytes once (needed for hash + size check + storage) ──
            file_bytes = file.file.read()
            file.file.seek(0)  # reset so storage can read it again

            # ── File size guard: 5 MB max ─────────────────────────────────────
            if len(file_bytes) > 5 * 1024 * 1024:
                failed += 1
                continue

            # ── Content hash: SHA-256 of raw bytes ────────────────────────────
            # This is the ONLY reliable duplicate key for HR uploads.
            # A filename-based check breaks after the AI renames the candidate
            # (full_name goes from "john_cv" → "John Smith"), so re-uploading
            # the same file would not be caught. The content hash is immutable
            # regardless of any downstream renaming.
            import hashlib
            content_hash = hashlib.sha256(file_bytes).hexdigest()

            # ── Duplicate check: same file content already uploaded to this vacancy ──
            existing = (
                db.query(models.Candidate)
                .join(models.Application)
                .filter(
                    models.Application.vacancy_id == vacancy_id,
                    models.Candidate.content_hash == content_hash,
                )
                .first()
            )
            if existing:
                failed += 1
                continue

            file_path = save_file_locally(file)

            # Use filename (without extension) as a temporary name until AI overwrites it.
            filename_base = file.filename.rsplit(".", 1)[0]

            # Create candidate with 'Uploaded' status — AI will fill in contact details asynchronously.
            candidate = models.Candidate(
                full_name=filename_base,
                email=None,
                phone=None,
                source="hr_upload",
                cv_file_path=file_path,
                content_hash=content_hash,
                uploaded_at=datetime.utcnow(),
            )
            db.add(candidate)
            db.flush()

            application = models.Application(
                vacancy_id=vacancy_id,
                candidate_id=candidate.id,
                status=STATUS_UPLOADED,
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
        "active_round": application.active_round if application else 1,
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

PANEL_PERMISSION = "recruitment:interview_panel"


def _users_with_panel_permission(db: Session) -> list[User]:
    """
    Return all active, non-deleted users who hold the
    'recruitment:interview_panel' permission (via any of their roles).
    """
    return (
        db.query(User)
        .join(user_roles, User.id == user_roles.c.user_id)
        .join(Role, Role.id == user_roles.c.role_id)
        .join(role_permissions, Role.id == role_permissions.c.role_id)
        .join(Permission, Permission.id == role_permissions.c.permission_id)
        .filter(
            Permission.permission_name == PANEL_PERMISSION,
            User.is_active == True,
            User.is_deleted == False,
        )
        .distinct()
        .all()
    )


def get_panel_eligible_users(db: Session) -> list[dict]:
    """Return serialisable list of users eligible to be panel head or member."""
    users = _users_with_panel_permission(db)
    return [
        {
            "id": u.id,
            "first_name": u.first_name or "",
            "last_name": u.last_name or "",
            "full_name": f"{u.first_name or ''} {u.last_name or ''}".strip(),
            "email": u.email,
        }
        for u in users
    ]


def _user_has_panel_permission(db: Session, user_id: int) -> bool:
    """Return True if the user with the given ID has 'recruitment:interview_panel'."""
    eligible_ids = {u.id for u in _users_with_panel_permission(db)}
    return user_id in eligible_ids


def _get_user_full_name(db: Session, user_id: int) -> str:
    user = db.query(User).filter(User.id == user_id, User.is_deleted == False).first()
    if not user:
        return f"User #{user_id}"
    return f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email


def upsert_interview_panel(db: Session, vacancy_id: int, data: schemas.InterviewPanelCreate):
    """Create or fully replace the interview panel for a vacancy.

    Validates:
    - vacancy exists
    - panel_head_id refers to a real active user with recruitment:interview_panel
    - every member_id refers to a real active user with recruitment:interview_panel
    - panel head is not duplicated in member_ids
    """
    vacancy = db.query(models.Vacancy).filter(models.Vacancy.id == vacancy_id).first()
    if not vacancy:
        raise HTTPException(status_code=404, detail="Vacancy not found")

    # ── Validate panel head ──────────────────────────────────────────────────
    head_user = (
        db.query(User)
        .filter(User.id == data.panel_head_id, User.is_deleted == False)
        .first()
    )
    if not head_user:
        raise HTTPException(
            status_code=422,
            detail="Panel Head user not found. Please select a valid system user.",
        )
    if not _user_has_panel_permission(db, data.panel_head_id):
        raise HTTPException(
            status_code=422,
            detail=(
                f"'{head_user.first_name} {head_user.last_name}' does not have the "
                "'Interview Panel' permission. Assign this permission to them via "
                "Role Management before adding them as Panel Head."
            ),
        )

    # ── Validate members ─────────────────────────────────────────────────────
    unique_member_ids = list(dict.fromkeys(
        mid for mid in data.member_ids if mid != data.panel_head_id
    ))
    for mid in unique_member_ids:
        member_user = (
            db.query(User)
            .filter(User.id == mid, User.is_deleted == False)
            .first()
        )
        if not member_user:
            raise HTTPException(
                status_code=422,
                detail=f"Panel member user ID {mid} not found.",
            )
        if not _user_has_panel_permission(db, mid):
            raise HTTPException(
                status_code=422,
                detail=(
                    f"'{member_user.first_name} {member_user.last_name}' does not "
                    "have the 'Interview Panel' permission."
                ),
            )

    # ── Upsert panel row ──────────────────────────────────────────────────────
    panel = (
        db.query(models.InterviewPanel)
        .filter(models.InterviewPanel.vacancy_id == vacancy_id)
        .first()
    )
    # Remember who was already on the panel so we only notify people whose
    # assignment is actually new — this endpoint replaces the whole panel and
    # is re-saved on every edit, so notifying everyone each time would spam.
    previously_assigned: set[int] = set()
    if panel:
        if panel.panel_head_id:
            previously_assigned.add(panel.panel_head_id)
        previously_assigned.update(
            uid for (uid,) in db.query(models.InterviewPanelMember.user_id)
            .filter(models.InterviewPanelMember.panel_id == panel.id)
            .all()
        )

    if panel:
        panel.panel_head_id = data.panel_head_id
        panel.interview_link = data.interview_link
    else:
        panel = models.InterviewPanel(
            vacancy_id=vacancy_id,
            panel_head_id=data.panel_head_id,
            interview_link=data.interview_link,
        )
        db.add(panel)
        db.flush()  # get panel.id before inserting members

    # ── Replace member list ───────────────────────────────────────────────────
    # Delete existing members and re-insert so order/additions/removals all work.
    db.query(models.InterviewPanelMember).filter(
        models.InterviewPanelMember.panel_id == panel.id
    ).delete(synchronize_session=False)

    for mid in unique_member_ids:
        db.add(models.InterviewPanelMember(panel_id=panel.id, user_id=mid))

    db.commit()
    db.refresh(panel)

    _notify_new_panel_members(
        db,
        vacancy=vacancy,
        panel=panel,
        newly_assigned=[
            uid for uid in ([data.panel_head_id] + unique_member_ids)
            if uid not in previously_assigned
        ],
    )

    return _enrich_panel(db, panel)


def _notify_new_panel_members(db: Session, *, vacancy, panel, newly_assigned: list[int]) -> None:
    """
    Tell people they've been put on an interview panel.

    Sent only to newly-assigned users. Never raises — a notification failure
    must not undo a saved panel.
    """
    if not newly_assigned:
        return
    try:
        from app.notifications.service import notify_users

        head_id = panel.panel_head_id
        for user_id in newly_assigned:
            role = "Panel Head" if user_id == head_id else "Panel Member"
            message = (
                f"You've been added as {role} for the {vacancy.title} interview panel"
            )
            notify_users(
                db,
                [user_id],
                message,
                category="recruitment",
                type="info",
                link=f"/recruitment/{vacancy.id}",
                entity_type="vacancy",
                entity_id=str(vacancy.id),
            )
        db.commit()
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(
            f"[Recruitment] Panel assignment notification failed: {e}"
        )
        db.rollback()


def get_interview_panel(db: Session, vacancy_id: int):
    panel = (
        db.query(models.InterviewPanel)
        .filter(models.InterviewPanel.vacancy_id == vacancy_id)
        .first()
    )
    if not panel:
        return None
    return _enrich_panel(db, panel)


def _enrich_panel(db: Session, panel: models.InterviewPanel) -> dict:
    """Attach human-readable names to the panel for the response."""
    head_name = None
    if panel.panel_head_id:
        head_name = _get_user_full_name(db, panel.panel_head_id)

    members = [
        schemas.InterviewPanelMemberInfo(
            user_id=m.user_id,
            full_name=_get_user_full_name(db, m.user_id),
        )
        for m in panel.members
    ]

    return schemas.InterviewPanelResponse(
        id=panel.id,
        vacancy_id=panel.vacancy_id,
        panel_head_id=panel.panel_head_id,
        panel_head_name=head_name,
        interview_link=panel.interview_link,
        members=members,
    )


def get_my_panel_role(db: Session, vacancy_id: int, user_id: int) -> str | None:
    """
    Return the current user's role on the vacancy's interview panel.
    Returns: 'head' | 'member' | None (not on panel)
    """
    panel = (
        db.query(models.InterviewPanel)
        .filter(models.InterviewPanel.vacancy_id == vacancy_id)
        .first()
    )
    if not panel:
        return None
    if panel.panel_head_id == user_id:
        return "head"
    member = (
        db.query(models.InterviewPanelMember)
        .filter(
            models.InterviewPanelMember.panel_id == panel.id,
            models.InterviewPanelMember.user_id == user_id,
        )
        .first()
    )
    if member:
        return "member"
    return None


def get_panel_completion_status(db: Session, vacancy_id: int, application_id: int, round_number: int) -> dict:
    """
    For a given vacancy + application + round, return:
      - total panel member count (head + members)
      - list of who has submitted and who hasn't
    Used by the final-decision gate.
    """
    panel = (
        db.query(models.InterviewPanel)
        .filter(models.InterviewPanel.vacancy_id == vacancy_id)
        .first()
    )
    if not panel:
        return {"all_submitted": True, "total": 0, "submitted": [], "pending": []}

    # Build full panel member list: head + all members
    all_members: list[dict] = []
    if panel.panel_head_id:
        all_members.append({"user_id": panel.panel_head_id, "role": "head",
                             "full_name": _get_user_full_name(db, panel.panel_head_id)})
    for m in panel.members:
        all_members.append({"user_id": m.user_id, "role": "member",
                            "full_name": _get_user_full_name(db, m.user_id)})

    # Fetch evaluations for this round
    submitted_user_ids = set(
        row.evaluator_user_id
        for row in db.query(models.InterviewEvaluation.evaluator_user_id)
        .filter(
            models.InterviewEvaluation.application_id == application_id,
            models.InterviewEvaluation.round_number == round_number,
            models.InterviewEvaluation.evaluator_user_id.isnot(None),
        )
        .all()
    )

    submitted = [m for m in all_members if m["user_id"] in submitted_user_ids]
    pending   = [m for m in all_members if m["user_id"] not in submitted_user_ids]

    return {
        "all_submitted": len(pending) == 0,
        "total": len(all_members),
        "submitted": submitted,
        "pending": pending,
    }


def get_my_evaluation_status(db: Session, application_id: int, user_id: int, round_number: int) -> dict:
    """
    Check whether the given user has already submitted an evaluation for this
    application in the specified round.  Returns {"submitted": bool}.
    """
    exists = (
        db.query(models.InterviewEvaluation)
        .filter(
            models.InterviewEvaluation.application_id == application_id,
            models.InterviewEvaluation.evaluator_user_id == user_id,
            models.InterviewEvaluation.round_number == round_number,
        )
        .first()
    )
    return {"submitted": exists is not None}


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

def create_evaluation(db: Session, application_id: int, data: schemas.EvaluationCreate, current_user: User = None):
    application = (
        db.query(models.Application)
        .filter(models.Application.id == application_id)
        .first()
    )
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # ── Guard: caller must be on the panel for this specific vacancy ──────────────────────
    if current_user is not None:
        _assert_panel_member(db, application.vacancy_id, current_user)

    if data.evaluator_user_id:
        duplicate = (
            db.query(models.InterviewEvaluation)
            .filter(
                models.InterviewEvaluation.application_id == application_id,
                models.InterviewEvaluation.round_number == data.round_number,
                models.InterviewEvaluation.evaluator_user_id == data.evaluator_user_id,
            )
            .first()
        )
        if duplicate:
            raise HTTPException(
                status_code=400,
                detail="You have already submitted an evaluation for this round.",
            )
    elif data.evaluator_name:
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
        round_number=data.round_number,
        technical_skills=data.technical_skills,
        problem_solving=data.problem_solving,
        communication=data.communication,
        cultural_fit=data.cultural_fit,
        attitude=data.attitude,
        overall_score=overall_score,
        comments=data.comments,
        needs_another_round=data.needs_another_round,
        evaluator_name=data.evaluator_name,
        evaluator_user_id=data.evaluator_user_id,
    )
    db.add(evaluation)

    # Advance application status based on the round number (spec §4 status progression)
    if data.round_number == 1:
        application.status = STATUS_FIRST_ROUND
    elif data.round_number == 2:
        application.status = STATUS_SECOND_ROUND
    else:
        application.status = f"Interview Round {data.round_number}"

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
    """Aggregate all evaluations + candidate/vacancy info for the panel head decision page.
    Averages are computed only for the current active round; previous rounds are returned
    separately so they can be displayed as historical reference.
    """
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

    # All evaluations ordered by round
    all_evals = (
        db.query(models.InterviewEvaluation)
        .filter(models.InterviewEvaluation.application_id == application_id)
        .order_by(
            models.InterviewEvaluation.round_number.asc(),
            models.InterviewEvaluation.id.asc(),
        )
        .all()
    )

    # Current round is the application's active_round field
    current_round = application.active_round or 1

    # Split evaluations: current round vs previous rounds
    current_evals = [e for e in all_evals if e.round_number == current_round]
    previous_evals = [e for e in all_evals if e.round_number < current_round]

    # Group previous evals by round number for structured display
    from collections import defaultdict
    prev_by_round: dict[int, list] = defaultdict(list)
    for e in previous_evals:
        prev_by_round[e.round_number].append(e)

    def avg(attr, evals):
        vals = [getattr(e, attr) for e in evals if getattr(e, attr, 0) > 0]
        return round(sum(vals) / len(vals), 1) if vals else 0.0

    # Averages computed ONLY from current round evaluations
    category_averages = {
        "technical_skills": avg("technical_skills", current_evals),
        "problem_solving":  avg("problem_solving",  current_evals),
        "communication":    avg("communication",    current_evals),
        "cultural_fit":     avg("cultural_fit",     current_evals),
        "attitude":         avg("attitude",         current_evals),
    }
    panel_avg = (
        round(sum(e.overall_score for e in current_evals) / len(current_evals), 1)
        if current_evals
        else 0.0
    )

    existing_decision = (
        db.query(models.FinalDecision)
        .filter(models.FinalDecision.application_id == application_id)
        .first()
    )

    # Fetch the panel to resolve who the actual panel head is
    panel = db.query(models.InterviewPanel).filter(
        models.InterviewPanel.vacancy_id == application.vacancy_id
    ).first()
    panel_head_user_id = panel.panel_head_id if panel else None

    return {
        "candidate": {
            "id": candidate.id,
            "full_name": candidate.full_name,
            "phone": candidate.phone,
            "email": candidate.email,
        },
        "vacancy": {"id": vacancy.id, "title": vacancy.title},
        # Current round evaluations (used for averages)
        "evaluations": current_evals,
        # Previous rounds — grouped by round number for historical display
        "previous_rounds": {
            str(r): evals for r, evals in sorted(prev_by_round.items())
        },
        "current_round": current_round,
        "category_averages": category_averages,
        "panel_avg_score": panel_avg,
        "evaluator_count": len(current_evals),
        "final_decision": existing_decision,
        "application_id": application_id,
        # The true panel head's user ID — used by the frontend to badge
        # evaluations correctly regardless of submission order.
        "panel_head_user_id": panel_head_user_id,
    }


async def submit_final_decision(db: Session, application_id: int, data: schemas.FinalDecisionCreate, background_tasks=None, current_user: User = None):
    """Record the panel head's final decision, update status, and email the candidate in the background."""

    # ── Guard: caller must be on the panel for this specific vacancy ──────────────────────
    if current_user is not None:
        app_check = db.query(models.Application).filter(models.Application.id == application_id).first()
        if app_check:
            _assert_panel_member(db, app_check.vacancy_id, current_user)

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

    # ── Notify HR (non-critical, don't block) ────────────────────────────────
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

    # ── Send outcome email in the background — response returns immediately ───
    if background_tasks:
        candidate = db.query(models.Candidate).filter(models.Candidate.id == application.candidate_id).first()
        vacancy = db.query(models.Vacancy).filter(models.Vacancy.id == application.vacancy_id).first()
        panel = db.query(models.InterviewPanel).filter(models.InterviewPanel.vacancy_id == application.vacancy_id).first()

        if candidate and vacancy and _has_valid_email(candidate.email):
            if data.decision == DECISION_JOB_OFFERED:
                background_tasks.add_task(
                    send_job_offer_email,
                    to=candidate.email,
                    candidate_name=candidate.full_name,
                    job_title=vacancy.title,
                )
            elif data.decision == DECISION_REJECTED:
                background_tasks.add_task(
                    send_rejection_email,
                    to=candidate.email,
                    candidate_name=candidate.full_name,
                    job_title=vacancy.title,
                )
            elif data.decision == DECISION_NEXT_ROUND and panel and panel.interview_link:
                background_tasks.add_task(
                    send_scheduling_email,
                    to=candidate.email,
                    candidate_name=candidate.full_name,
                    job_title=vacancy.title,
                    interview_link=panel.interview_link,
                )

    return existing


def trigger_next_round(db: Session, application_id: int, current_user: User = None):
    """
    Called when panel head selects 'Proceed to Next Round'.
    Increments application.active_round by 1 (Round 1 → 2 → 3 …).
    Clears the FinalDecision record for this round so the head can decide afresh.
    """
    application = (
        db.query(models.Application)
        .filter(models.Application.id == application_id)
        .first()
    )
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # ── Guard: caller must be on the panel for this specific vacancy ──────────────────────
    if current_user is not None:
        _assert_panel_member(db, application.vacancy_id, current_user)

    # Increment the round counter — works for Round 2, 3, 4, …
    next_round = (application.active_round or 1) + 1
    application.active_round = next_round

    # Keep status meaningful: First Round → Second Round for Round 2,
    # "Interview Round N" for subsequent rounds.
    if next_round == 2:
        application.status = STATUS_SECOND_ROUND
    else:
        application.status = f"Interview Round {next_round}"

    # Delete the previous final decision — it was for the prior round only
    db.query(models.FinalDecision).filter(
        models.FinalDecision.application_id == application_id
    ).delete()

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
    """Re-score all candidates for a vacancy via the AI screening service.

    Also updates name, email, and phone — so this can fix candidates whose
    contact info was never extracted (e.g. uploaded while AI was offline).
    """
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
            from app.core.storage_service import storage as _storage
            import os
            tmp_path = None
            try:
                tmp_path = _storage.abs_path(candidate.cv_file_path)
                result = ai_screen(
                    cv_file_path=tmp_path,
                    title=vacancy.title,
                    experience_level=vacancy.experience_level,
                    description=vacancy.description,
                    requirements=vacancy.requirements,
                )
            finally:
                from app.core.config import STORAGE_BACKEND
                if STORAGE_BACKEND == "s3" and tmp_path and os.path.exists(tmp_path):
                    os.remove(tmp_path)

            # Update all extractable fields, not just the AI score
            if result.full_name and result.full_name.strip():
                candidate.full_name = result.full_name
            if not _has_valid_email(candidate.email):
                candidate.email = result.email
            candidate.phone = result.phone if result.phone else "Not provided"
            candidate.ai_score = result.ai_score
            candidate.ai_reasoning = result.ai_reasoning
            scored += 1
        except Exception as exc:
            logger.error("AI re-score failed for candidate %d: %s", candidate.id, exc)

    db.commit()
    return {"scored": scored, "total": len(applications)}