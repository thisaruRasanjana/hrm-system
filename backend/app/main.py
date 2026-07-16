import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
import os
import logging

from app.database.database import engine, SessionLocal
from app.database.base import Base

logger = logging.getLogger(__name__)

# ── Import all models ──
import app.roles.models             # noqa: F401
import app.auth.models              # noqa: F401
import app.departments.models       # noqa: F401
import app.employees.models         # noqa: F401
import app.time_tracking.models     # noqa: F401
import app.messages.models          # noqa: F401
import app.announcements.models     # noqa: F401
import app.events.models            # noqa: F401
import app.notifications.models     # noqa: F401
import app.calendar_holidays.models # noqa: F401
import app.dashboard.models         # noqa: F401

# ── Document models ────────────────────────────────────────────────────────────
from app.documents.models.model import EmployeeDocument              # noqa: F401
from app.documents.models.template_model import DocumentTemplate     # noqa: F401
from app.documents.models.document_type_model import DocumentType    # noqa: F401
from app.documents.models.audit_log_model import DocumentAuditLog    # noqa: F401
from app.documents.models.request_model import DocumentRequest       # noqa: F401

# ── Routers ────────────────────────────────────────────────────────────────────
from app.auth.router          import router as auth_router
from app.roles.router         import router as roles_router
from app.employees.router     import router as employee_router
from app.leave.router         import router as leave_router
from app.reports.router       import router as reports_router
import app.leave.models             # noqa: F401 — register leave tables for create_all
from app.departments.router   import router as departments_router
from app.designations.router  import router as designations_router
from app.dashboard.router     import router as dashboard_router
from app.messages.router      import router as messages_router
from app.announcements.router import router as announcements_router
from app.events.router        import router as events_router
from app.calendar_holidays.router import router as holidays_router
from app.notifications.router import router as notifications_router
from app.time_tracking.router import router as time_tracking_router

# ── Document routers ───────────────────────────────────────────────────────────
from app.documents.routers.router               import router as documents_router
from app.documents.routers.approval_router      import router as approval_router
from app.documents.routers.request_router       import router as request_router
from app.documents.routers.hr_request_router    import router as hr_request_router
from app.documents.routers.template_router      import router as template_router
from app.documents.routers.document_type_router import router as document_type_router
from app.documents.routers.promotion_router     import router as promotion_letter_router

# ── Recruitment routers (from recruitment branch) ──────────────────────────────
try:
    from app.recruitment.router        import router as recruitment_router
    from app.recruitment.public_router import router as public_router
    _recruitment_available = True
except ImportError:
    _recruitment_available = False
    recruitment_router = None
    public_router = None
    logger.warning("Recruitment module not found — skipping.")

from app.core.config import EMAIL_POLL_INTERVAL_SECONDS

async def email_polling_loop():
    await asyncio.sleep(5)
    while True:
        try:
            from app.documents.services import email_service
            db = SessionLocal()
            try:
                result = await asyncio.to_thread(email_service.fetch_and_process_external_requests, db)
            finally:
                db.close()
            if isinstance(result, int) and result > 0:
                print(f"[Email Poller] Synced {result} new external email request(s).")
        except Exception as e:
            print(f"[Email Poller] Loop Error: {e}")
        await asyncio.sleep(EMAIL_POLL_INTERVAL_SECONDS)


async def holiday_reminder_loop():
    """Background loop that checks once per hour for tomorrow's holidays and notifies all active users."""
    await asyncio.sleep(30)  # Delay startup to let DB initialize
    notified_dates: set = set()  # Track which dates we've already notified about today
    while True:
        try:
            from datetime import date, timedelta
            from app.calendar_holidays.models import Holiday
            from app.auth.models import User
            from app.notifications.service import notify_users

            tomorrow = (date.today() + timedelta(days=1)).isoformat()
            today_key = date.today().isoformat()

            # Only send once per calendar day
            if today_key not in notified_dates:
                db = SessionLocal()
                try:
                    holidays = db.query(Holiday).filter(Holiday.date == tomorrow).all()
                    if holidays:
                        # Get all active user IDs
                        active_user_ids = [
                            uid for (uid,) in
                            db.query(User.id).filter(User.is_active == True).all()
                        ]
                        if active_user_ids:
                            for holiday in holidays:
                                notify_users(
                                    db,
                                    active_user_ids,
                                    f"\U0001f4c5 Tomorrow is {holiday.name}",
                                    category="holiday",
                                    type="info",
                                    link="/dashboard#widget-calendar",
                                )
                            db.commit()
                            notified_dates.add(today_key)
                            print(f"[Holiday Reminder] Sent {len(holidays)} holiday reminder(s) to {len(active_user_ids)} users.")
                finally:
                    db.close()

            # Clean up old date keys
            notified_dates.discard((date.today() - timedelta(days=2)).isoformat())
        except Exception as e:
            print(f"[Holiday Reminder] Loop Error: {e}")
        await asyncio.sleep(3600)  # Check every hour

async def daily_digest_loop():
    """
    Once-a-day background pass for time-based notifications.

    Covers what nobody triggers by hand: tomorrow's events, today's birthdays
    and work anniversaries, and the retention purge. Runs hourly but guards
    each job with a per-day key so a restart can't double-send.
    """
    await asyncio.sleep(45)  # let the DB settle, and stagger off the holiday loop
    sent_days: set = set()
    while True:
        try:
            from datetime import date, timedelta

            today = date.today()
            today_key = today.isoformat()

            if today_key not in sent_days:
                db = SessionLocal()
                try:
                    _notify_tomorrows_events(db, today)
                    _notify_celebrations(db, today)

                    from app.notifications.service import purge_expired_notifications
                    purged = purge_expired_notifications(db)
                    if purged:
                        print(f"[Notifications] Retention purge removed {purged} old notification(s).")

                    sent_days.add(today_key)
                finally:
                    db.close()

            # Keep the guard set from growing without bound.
            sent_days.discard((today - timedelta(days=2)).isoformat())
        except Exception as e:
            print(f"[Daily Digest] Loop Error: {e}")
        await asyncio.sleep(3600)


def _active_user_ids(db) -> list:
    from app.auth.models import User
    return [uid for (uid,) in db.query(User.id).filter(User.is_active == True).all()]


def _notify_tomorrows_events(db, today) -> None:
    """Remind everyone about events happening tomorrow."""
    try:
        from datetime import datetime, timedelta, time as dt_time
        from app.events.models import Event
        from app.notifications.service import notify_users

        tomorrow = today + timedelta(days=1)
        events = (
            db.query(Event)
            .filter(
                Event.event_date >= datetime.combine(tomorrow, dt_time.min),
                Event.event_date <= datetime.combine(tomorrow, dt_time.max),
            )
            .all()
        )
        if not events:
            return

        user_ids = _active_user_ids(db)
        if not user_ids:
            return

        for ev in events:
            when = ev.event_date.strftime("%I:%M %p").lstrip("0")
            location = f" at {ev.location}" if ev.location else ""
            notify_users(
                db,
                user_ids,
                f"Reminder: {ev.title} is tomorrow at {when}{location}",
                category="events",
                type="info",
                link="/dashboard#widget-upcoming_events",
                entity_type="event",
                entity_id=str(ev.id),
            )
        db.commit()
        print(f"[Event Reminder] Sent {len(events)} event reminder(s) to {len(user_ids)} users.")
    except Exception as e:
        print(f"[Event Reminder] Error: {e}")
        db.rollback()


def _notify_celebrations(db, today) -> None:
    """Announce today's birthdays and work anniversaries to the team."""
    try:
        from sqlalchemy import extract
        from app.employees.models import Employee
        from app.notifications.service import notify_users

        user_ids = _active_user_ids(db)
        if not user_ids:
            return

        active_employees = db.query(Employee).filter(
            (Employee.is_deleted == False) | (Employee.is_deleted.is_(None))
        )

        # ── Birthdays ────────────────────────────────────────────────
        birthdays = active_employees.filter(
            Employee.date_of_birth.isnot(None),
            extract("month", Employee.date_of_birth) == today.month,
            extract("day", Employee.date_of_birth) == today.day,
        ).all()

        for emp in birthdays:
            name = f"{emp.first_name} {emp.last_name}"
            notify_users(
                db,
                user_ids,
                f"\U0001f389 Today is {name}'s birthday",
                category="celebration",
                type="info",
                link="/dashboard/employees",
                entity_type="employee",
                entity_id=str(emp.id),
                # Don't tell someone it's their own birthday.
                exclude_user_id=emp.user_id,
            )

        # ── Work anniversaries ───────────────────────────────────────
        anniversaries = active_employees.filter(
            Employee.joined_date.isnot(None),
            extract("month", Employee.joined_date) == today.month,
            extract("day", Employee.joined_date) == today.day,
        ).all()

        for emp in anniversaries:
            years = today.year - emp.joined_date.year
            if years < 1:
                continue  # their start date, not an anniversary
            name = f"{emp.first_name} {emp.last_name}"
            label = "1 year" if years == 1 else f"{years} years"
            notify_users(
                db,
                user_ids,
                f"\U0001f38a {name} completes {label} at the company today",
                category="celebration",
                type="info",
                link="/dashboard/employees",
                entity_type="employee",
                entity_id=str(emp.id),
                exclude_user_id=emp.user_id,
            )

        if birthdays or anniversaries:
            db.commit()
            print(f"[Celebrations] Sent {len(birthdays)} birthday(s), {len(anniversaries)} anniversary(ies).")
    except Exception as e:
        print(f"[Celebrations] Error: {e}")
        db.rollback()


# ── Seed helpers ───────────────────────────────────────────────────────────────
from app.roles.seed       import seed_roles
from app.departments.seed import seed_departments


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        try:
            seed_departments(db)
        except Exception as e:
            print(f"[WARNING] seed_departments skipped: {e}")
        try:
            seed_roles(db)
        except Exception as e:
            print(f"[WARNING] seed_roles skipped (DB migration may be needed): {e}")
        try:
            # Seed default overtime threshold (8h) if none exists
            from app.time_tracking.models import OvertimeThresholdHistory
            from datetime import date as date_type
            from decimal import Decimal
            existing_threshold = db.query(OvertimeThresholdHistory).first()
            if not existing_threshold:
                default_threshold = OvertimeThresholdHistory(
                    threshold_hours=Decimal("8.00"),
                    effective_date=date_type(2000, 1, 1),
                    created_by_user_id=None,
                )
                db.add(default_threshold)
                db.commit()
                print("[Seed] Default overtime threshold (8h) created.")
        except Exception as e:
            print(f"[WARNING] seed_overtime_threshold skipped: {e}")
        try:
            from app.calendar_holidays.router import seed_holidays
            seed_holidays()
        except Exception as e:
            print(f"[WARNING] seed_holidays skipped: {e}")
        try:
            from app.leave.seed import seed_leave_types
            seed_leave_types(db)
        except Exception as e:
            print(f"[WARNING] seed_leave_types skipped: {e}")
        try:
            from app.documents.services.document_type_service import seed_request_document_types
            seed_request_document_types(db)
        except Exception as e:
            print(f"[WARNING] seed_request_document_types skipped: {e}")
    finally:
        db.close()

    email_task = asyncio.create_task(email_polling_loop())
    print(f"[Email Poller] Background email polling started (every {EMAIL_POLL_INTERVAL_SECONDS} seconds).")
    holiday_task = asyncio.create_task(holiday_reminder_loop())
    print("[Holiday Reminder] Background holiday reminder loop started (checks every hour).")
    digest_task = asyncio.create_task(daily_digest_loop())
    print("[Daily Digest] Event reminders, celebrations and retention purge started (checks every hour).")

    # APScheduler runs the nightly designation-expiry check; it is independent of
    # the asyncio loops above, so a failure to start must not take them down.
    from app.core.scheduler import start_scheduler, shutdown_scheduler
    try:
        start_scheduler()
    except Exception as e:
        print(f"[Scheduler] Failed to start APScheduler: {e}")

    yield

    email_task.cancel()
    holiday_task.cancel()
    digest_task.cancel()

    try:
        shutdown_scheduler()
    except Exception as e:
        print(f"[Scheduler] Failed to shutdown APScheduler: {e}")
    try:
        await email_task
    except asyncio.CancelledError:
        pass
    try:
        await holiday_task
    except asyncio.CancelledError:
        pass
    try:
        await digest_task
    except asyncio.CancelledError:
        pass
    print("[Email Poller] Background email polling stopped.")
    print("[Holiday Reminder] Background holiday reminder loop stopped.")
    print("[Daily Digest] Background daily digest loop stopped.")


app = FastAPI(
    title="HRM System API",
    version="2.0.0",
    description="Role-based HRM System — permissions managed via /roles/",
    lifespan=lifespan,
    redirect_slashes=False,
)

# ── CORS ───────────────────────────────────────────────────────────────────────
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register API routers ───────────────────────────────────────────────────────
app.include_router(auth_router,          prefix="/auth",          tags=["Authentication"])
app.include_router(roles_router,         prefix="/roles",         tags=["Roles & Permissions"])
app.include_router(employee_router,      prefix="/employees",     tags=["Employees"])
app.include_router(leave_router,         tags=["Leave"])  # router defines its own /leave prefix
app.include_router(reports_router,       tags=["Reports"])
app.include_router(departments_router,   prefix="/departments",   tags=["Departments"])
app.include_router(designations_router,  prefix="/designations",  tags=["Designations"])
app.include_router(dashboard_router,     prefix="/dashboard",     tags=["Dashboard"])
app.include_router(messages_router,      prefix="/messages",      tags=["Messages"])
app.include_router(announcements_router, prefix="/announcements", tags=["Announcements"])
app.include_router(events_router,        prefix="/events",        tags=["Events"])
app.include_router(holidays_router,      prefix="/holidays",      tags=["Holidays"])
app.include_router(notifications_router, prefix="/notifications", tags=["Notifications"])
app.include_router(time_tracking_router, prefix="/time-tracking", tags=["Time Tracking"])

if recruitment_router is not None and public_router is not None:
    app.include_router(recruitment_router)
    app.include_router(public_router)

# ── Document routers ───────────────────────────────────────────────────────────
app.include_router(documents_router,        tags=["Employee Documents"])
app.include_router(approval_router,         tags=["Document Approval"])
app.include_router(request_router,          tags=["Document Requests"])
app.include_router(hr_request_router,       tags=["HR Document Requests"])
app.include_router(template_router,         tags=["Document Templates"])
app.include_router(document_type_router,    tags=["Document Types"])
app.include_router(promotion_letter_router, tags=["Promotion Letters"])

# ── Static file uploads (Local Only) ───────────────────────────────────────────
from app.core.config import STORAGE_BACKEND
if STORAGE_BACKEND != "s3":
    os.makedirs("uploads/profiles", exist_ok=True)
    os.makedirs("uploads/documents", exist_ok=True)
    os.makedirs("uploads/templates", exist_ok=True)
    os.makedirs("uploads/generated_documents", exist_ok=True)
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ── Root ───────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"message": "HRM System API v2.0 — Role-based permissions active"}

security_bearer = HTTPBearer()

@app.get("/protected")
def protected_route(credentials: HTTPAuthorizationCredentials = Depends(security_bearer)):
    return {"message": "Authorized", "token": credentials.credentials}
