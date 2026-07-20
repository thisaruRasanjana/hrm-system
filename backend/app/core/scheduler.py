"""
Distributed Job Scheduler — PostgreSQL Advisory Lock Pattern
============================================================

Architecture
------------
In a production multi-worker deployment (e.g. `uvicorn --workers 4`), every
worker process starts its own APScheduler instance, which means the nightly job
would fire N times — one per worker — sending duplicate notifications.

The fix is a **PostgreSQL advisory lock**: a lightweight, in-database mutex that
works across all processes sharing the same PostgreSQL connection.

How it works:
  1. At fire time, every worker calls `pg_try_advisory_lock(key)`.
  2. PostgreSQL gives the lock to exactly ONE worker — it returns `true`.
     All others get `false` and immediately return (do nothing).
  3. The winner runs the job, then calls `pg_advisory_unlock(key)`.
  4. If the winner crashes mid-job, PostgreSQL automatically releases the lock
     when the DB session closes — no stale locks, ever.

Benefits:
  - No Redis, no Celery, no extra infrastructure.
  - Uses the existing PostgreSQL database that is already running.
  - Zero new dependencies beyond what is already in requirements.txt.
  - Safe for any number of workers / replicas.
"""

import asyncio
import hashlib
import logging
from contextlib import contextmanager
from datetime import date, datetime, timedelta

from sqlalchemy import text
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.core.config import EMAIL_POLL_INTERVAL_SECONDS
from app.database.database import SessionLocal
from app.employees.models import Employee, EmployeeDesignationHistory
from app.notifications.service import notify_users, get_user_ids_with_permission

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

# ── Distributed lock helpers ──────────────────────────────────────────────────

def _pg_lock_key(job_name: str) -> int:
    """
    Derive a stable, unique PostgreSQL bigint advisory lock key from a job name.

    PostgreSQL advisory locks take a signed 64-bit integer key. We hash the
    job name with SHA-256, take the first 15 hex characters (60 bits) and fit
    them into the signed range (max 2^62) to avoid overflow.
    """
    return int(hashlib.sha256(job_name.encode()).hexdigest()[:15], 16) % (2 ** 62)


def _try_acquire_lock(db, key: int) -> bool:
    """Return True if this worker acquired the advisory lock, False otherwise."""
    result = db.execute(text("SELECT pg_try_advisory_lock(:key)"), {"key": key})
    return bool(result.scalar())


def _release_lock(db, key: int) -> None:
    """Release an advisory lock acquired by this session."""
    db.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": key})


@contextmanager
def advisory_lock(job_name: str):
    """Acquire a Postgres advisory lock for the duration of one job cycle.

    Yields True if THIS process won the lock (and should run the work), or False
    if another worker holds it. This is what keeps the background loops in
    main.py (email poller, holiday reminder, daily digest) from firing once per
    worker under ``uvicorn --workers N`` — the same guarantee the APScheduler job
    below already relies on. The lock is always released and its session closed
    on exit, even if the body raises.

    Usage::

        with advisory_lock("email_poller") as got_lock:
            if got_lock:
                ...  # do the once-per-cycle work
    """
    key = _pg_lock_key(job_name)
    db = SessionLocal()
    acquired = False
    try:
        acquired = _try_acquire_lock(db, key)
        yield acquired
    finally:
        if acquired:
            try:
                _release_lock(db, key)
            except Exception as exc:  # pragma: no cover - best-effort release
                logger.warning("[Scheduler] Failed to release lock for %s: %s", job_name, exc)
        db.close()


# ── Job: inbound email poller ────────────────────────────────────────────────

_EMAIL_POLLER_JOB = "email_poller"


async def poll_email_inbox(*, force: bool = False) -> int:
    """Run ONE inbound-email poll cycle. Returns the number of requests created.

    Replaces the former hand-rolled ``while True: await asyncio.sleep(...)`` loop
    in main.py. APScheduler gives us ``max_instances=1`` (a slow IMAP cycle can
    never overlap itself), a real job registry, and the same lifecycle as every
    other scheduled job — the old loop was invisible and unmanageable.

    The blocking IMAP/DB work is offloaded with ``asyncio.to_thread`` so it never
    stalls the event loop.

    Args:
        force: Bypass the advisory lock. Only for the manual "poll now" trigger,
            where the operator explicitly wants this process to do the work.
    """
    from app.documents.services import email_service

    def _run() -> int:
        db = SessionLocal()
        try:
            return email_service.fetch_and_process_external_requests(db)
        finally:
            db.close()

    logger.info("[Email Poller] step6: poll cycle starting (force=%s)", force)

    if force:
        created = await asyncio.to_thread(_run)
        logger.info("[Email Poller] step6: forced cycle finished, %s created", created)
        return created

    # ── Step 7: only one worker per cycle ────────────────────────────────────
    # Under `uvicorn --workers N` every worker schedules this job, so without the
    # advisory lock the same inbox would be polled N times concurrently.
    with advisory_lock(_EMAIL_POLLER_JOB) as got_lock:
        if not got_lock:
            # Previously this branch logged NOTHING, so a poller that never ran
            # was indistinguishable from one finding no mail.
            logger.info(
                "[Email Poller] step7: lock held by another worker — skipping this cycle."
            )
            return 0
        logger.info("[Email Poller] step7: advisory lock acquired — this worker owns the cycle.")
        created = await asyncio.to_thread(_run)
        logger.info("[Email Poller] step6: cycle finished, %s request(s) created", created)
        return created


# ── Job: nightly designation-expiry check ────────────────────────────────────

_DESIGNATION_EXPIRY_JOB = "check_expiring_designations"
_DESIGNATION_EXPIRY_KEY = _pg_lock_key(_DESIGNATION_EXPIRY_JOB)


async def check_expiring_designations() -> None:
    """
    Nightly job: find employees whose active designation period ends today or in
    exactly 3 days, and send a warning notification to all HR users who have the
    'employee:update' permission.

    Protected by a PostgreSQL advisory lock so only one worker runs this even
    when the application is deployed with multiple processes.
    """
    db = SessionLocal()
    try:
        # ── Step 1: Acquire distributed lock ─────────────────────────────────
        acquired = _try_acquire_lock(db, _DESIGNATION_EXPIRY_KEY)
        if not acquired:
            # Another worker is already handling this run — do nothing.
            logger.info(
                "[Scheduler] %s: lock held by another worker — skipping.",
                _DESIGNATION_EXPIRY_JOB,
            )
            return

        logger.info("[Scheduler] %s: lock acquired — running job.", _DESIGNATION_EXPIRY_JOB)

        # ── Step 2: Do the work ───────────────────────────────────────────────
        try:
            today = date.today()
            in_3_days = today + timedelta(days=3)

            expiring = (
                db.query(Employee, EmployeeDesignationHistory)
                .join(
                    EmployeeDesignationHistory,
                    Employee.id == EmployeeDesignationHistory.employee_id,
                )
                .filter(
                    Employee.status == "active",
                    EmployeeDesignationHistory.end_date.in_([today, in_3_days]),
                )
                .all()
            )

            if not expiring:
                logger.info("[Scheduler] %s: no expiring designations found.", _DESIGNATION_EXPIRY_JOB)
                return

            hr_user_ids = get_user_ids_with_permission(db, "employee:update")
            if not hr_user_ids:
                logger.warning(
                    "[Scheduler] %s: expiring designations found but no HR users to notify.",
                    _DESIGNATION_EXPIRY_JOB,
                )
                return

            for emp, hist in expiring:
                days_left = (hist.end_date - today).days
                when = "today" if days_left == 0 else f"in {days_left} days"
                message = (
                    f"Reminder: {emp.first_name} {emp.last_name}'s "
                    f"designation period ({hist.designation_name}) ends {when}. "
                    f"Please review their profile."
                )
                notify_users(
                    db,
                    hr_user_ids,
                    message,
                    category="system",
                    type="warning",
                    link=f"/dashboard/EmployeeManagement/edit?id={emp.id}",
                    entity_type="employee",
                    entity_id=str(emp.id),
                )
                logger.info(
                    "[Scheduler] Notified HR about %s %s (designation ends %s).",
                    emp.first_name,
                    emp.last_name,
                    when,
                )

            db.commit()

        except Exception as exc:
            logger.error("[Scheduler] %s: job failed: %s", _DESIGNATION_EXPIRY_JOB, exc)
            db.rollback()

        finally:
            # ── Step 3: Always release the lock ──────────────────────────────
            _release_lock(db, _DESIGNATION_EXPIRY_KEY)
            logger.info("[Scheduler] %s: lock released.", _DESIGNATION_EXPIRY_JOB)

    finally:
        db.close()


# ── Scheduler lifecycle ───────────────────────────────────────────────────────

def start_scheduler() -> None:
    """
    Attach jobs and start APScheduler.

    Safe to call in every worker — the PostgreSQL advisory locks inside each
    job function guarantee only one worker actually does the work at runtime.
    """
    if not scheduler.running:
        scheduler.add_job(
            check_expiring_designations,
            CronTrigger(hour=0, minute=5),   # 00:05 every night
            id=_DESIGNATION_EXPIRY_JOB,
            replace_existing=True,
            misfire_grace_time=3600,          # tolerate up to 1-hour misfire
        )
        scheduler.add_job(
            poll_email_inbox,
            IntervalTrigger(seconds=EMAIL_POLL_INTERVAL_SECONDS),
            id=_EMAIL_POLLER_JOB,
            replace_existing=True,
            # A slow IMAP cycle must never overlap the next one.
            max_instances=1,
            coalesce=True,
            misfire_grace_time=EMAIL_POLL_INTERVAL_SECONDS,
            # Don't wait a full interval for the first run after a restart.
            next_run_time=datetime.now() + timedelta(seconds=10),
        )
        scheduler.start()
        logger.info(
            "[Scheduler] APScheduler started (PG advisory lock enabled); "
            "email poller every %ss.", EMAIL_POLL_INTERVAL_SECONDS,
        )


def shutdown_scheduler() -> None:
    """Gracefully stop APScheduler on application shutdown."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("[Scheduler] APScheduler stopped.")
