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

# ── Recruitment routers (from recruitment branch) ──────────────────────────────
try:
    from app.recruitment.router        import router as recruitment_router
    from app.recruitment.public_router import router as public_router
    _recruitment_available = True
except ImportError:
    _recruitment_available = False
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

# ── Seed helpers ───────────────────────────────────────────────────────────────
from app.roles.seed       import seed_roles
from app.departments.seed import seed_departments


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)

    from sqlalchemy import text
    try:
        with engine.begin() as conn:
            # ── Patch users table with columns added in dev branch ────────────
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token TEXT"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100)"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'employee'"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS position VARCHAR"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id)"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth VARCHAR"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_number VARCHAR"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url VARCHAR"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS quiet_hours_start VARCHAR DEFAULT '22:00'"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS quiet_hours_end VARCHAR DEFAULT '08:00'"))

            # ── Patch document_requests with the inbound email body column ───
            conn.execute(text("ALTER TABLE document_requests ADD COLUMN IF NOT EXISTS requester_message TEXT"))

            # ── Patch document_types with the upload/request catalogue column ─
            conn.execute(text("ALTER TABLE document_types ADD COLUMN IF NOT EXISTS category VARCHAR(20) DEFAULT 'UPLOAD'"))

            # ── Patch notifications table with category + entity columns ────
            conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category VARCHAR"))
            conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_type VARCHAR"))
            conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_id VARCHAR"))

            # ── Time Tracking: new tables + columns for pause/resume ─────────
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS time_check_pairs (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    date DATE NOT NULL,
                    check_in TIMESTAMP NOT NULL,
                    check_out TIMESTAMP,
                    seconds INTEGER,
                    created_at TIMESTAMP DEFAULT now()
                )
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS overtime_threshold_history (
                    id SERIAL PRIMARY KEY,
                    threshold_hours NUMERIC(5,2) NOT NULL,
                    effective_date DATE NOT NULL,
                    created_by_user_id INTEGER,
                    created_at TIMESTAMP DEFAULT now()
                )
            """))
            conn.execute(text("ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS applied_threshold NUMERIC(5,2)"))
            # Create indexes for performance
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_time_check_pairs_user_date ON time_check_pairs (user_id, date)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_overtime_threshold_effective ON overtime_threshold_history (effective_date)"))

            # ── Patch employees table with columns added in dev branch ───────
            conn.execute(text("ALTER TABLE employees ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id)"))
            conn.execute(text("ALTER TABLE employees ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)"))
            conn.execute(text("ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE"))

            # ── Link employees to users by matching email ─────────────────────
            conn.execute(text("""
                UPDATE employees e
                SET user_id = u.id
                FROM users u
                WHERE e.email = u.email
                  AND e.user_id IS NULL
            """))

            # ── Backfill user_roles from scalar role_id for users missing entries ──
            conn.execute(text("""
                INSERT INTO user_roles (user_id, role_id)
                SELECT u.id, u.role_id
                FROM users u
                WHERE u.role_id IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM user_roles ur
                      WHERE ur.user_id = u.id AND ur.role_id = u.role_id
                  )
            """))

            # ── Patch permissions table (dev uses permission_name, resource, action) ──
            conn.execute(text("ALTER TABLE permissions ADD COLUMN IF NOT EXISTS permission_name VARCHAR(255)"))
            conn.execute(text("ALTER TABLE permissions ADD COLUMN IF NOT EXISTS resource VARCHAR(100)"))
            conn.execute(text("ALTER TABLE permissions ADD COLUMN IF NOT EXISTS action VARCHAR(100)"))
            conn.execute(text("ALTER TABLE permissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()"))
            # Copy existing 'name' into 'permission_name' where not already set
            conn.execute(text("""
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.columns
                               WHERE table_name = 'permissions' AND column_name = 'name') THEN
                        UPDATE permissions
                        SET permission_name = name
                        WHERE permission_name IS NULL AND name IS NOT NULL;
                    END IF;
                END $$;
            """))
            # Legacy 'name' column is NOT NULL but unmapped in the current model —
            # without this, every new permission INSERT fails and seed_roles is
            # silently skipped on startup.
            conn.execute(text("""
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.columns
                               WHERE table_name = 'permissions' AND column_name = 'name') THEN
                        ALTER TABLE permissions ALTER COLUMN name DROP NOT NULL;
                    END IF;
                END $$;
            """))

            # ── Patch roles table (dev uses role_name) ────────────────────────
            conn.execute(text("ALTER TABLE roles ADD COLUMN IF NOT EXISTS role_name VARCHAR(100)"))
            conn.execute(text("ALTER TABLE roles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()"))
            # Copy existing 'name' into 'role_name' where not already set
            conn.execute(text("""
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.columns
                               WHERE table_name = 'roles' AND column_name = 'name') THEN
                        UPDATE roles
                        SET role_name = name
                        WHERE role_name IS NULL AND name IS NOT NULL;
                    END IF;
                END $$;
            """))
            # Same legacy-column guard as permissions.name above
            conn.execute(text("""
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.columns
                               WHERE table_name = 'roles' AND column_name = 'name') THEN
                        ALTER TABLE roles ALTER COLUMN name DROP NOT NULL;
                    END IF;
                END $$;
            """))

            # ── Leave types: per-type annual entitlement ──────────────────────
            conn.execute(text("ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS default_days FLOAT"))
            conn.execute(text("ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS directly_requestable BOOLEAN NOT NULL DEFAULT TRUE"))
            conn.execute(text("UPDATE leave_types SET directly_requestable = FALSE WHERE LOWER(name) = 'medical'"))
            conn.execute(text("ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS parent_request_id INTEGER REFERENCES leave_requests(leave_request_id) ON DELETE SET NULL"))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS leave_medical_conversions (
                    id SERIAL PRIMARY KEY,
                    leave_request_id INTEGER NOT NULL REFERENCES leave_requests(leave_request_id) ON DELETE CASCADE,
                    employee_id INTEGER NOT NULL,
                    start_date DATE NOT NULL,
                    end_date DATE NOT NULL,
                    attachment_urls JSONB,
                    reason TEXT,
                    status VARCHAR(20) DEFAULT 'PENDING',
                    reviewer_id INTEGER,
                    reviewer_comment TEXT,
                    created_at TIMESTAMPTZ DEFAULT now()
                )
            """))

            # ── Leave requests: who assigned it (HR-on-behalf-of flow) ────────
            conn.execute(text("ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS assigned_by INTEGER"))

            # ── Patch recruitment tables created by an older model version ────
            conn.execute(text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS cv_file_path VARCHAR(500)"))
            conn.execute(text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP DEFAULT now()"))
            conn.execute(text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS ai_reasoning TEXT"))
            conn.execute(text("ALTER TABLE applications ADD COLUMN IF NOT EXISTS notes TEXT"))
            conn.execute(text("ALTER TABLE applications ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT now()"))
            # Multi-round panel evaluation columns (added with the panel workflow refactor)
            conn.execute(text("ALTER TABLE applications ADD COLUMN IF NOT EXISTS active_round INTEGER NOT NULL DEFAULT 1"))
            conn.execute(text("ALTER TABLE interview_evaluations ADD COLUMN IF NOT EXISTS round_number SMALLINT NOT NULL DEFAULT 1"))
            conn.execute(text("ALTER TABLE interview_evaluations ADD COLUMN IF NOT EXISTS needs_another_round BOOLEAN NOT NULL DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE interview_evaluations ADD COLUMN IF NOT EXISTS evaluator_user_id INTEGER"))
            # Migrate data from the old column names where present
            conn.execute(text("""
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.columns
                               WHERE table_name = 'candidates' AND column_name = 'cv_path') THEN
                        UPDATE candidates SET cv_file_path = cv_path
                        WHERE cv_file_path IS NULL AND cv_path IS NOT NULL;
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.columns
                               WHERE table_name = 'candidates' AND column_name = 'ai_summary') THEN
                        UPDATE candidates SET ai_reasoning = ai_summary
                        WHERE ai_reasoning IS NULL AND ai_summary IS NOT NULL;
                    END IF;
                END $$;
            """))

            # ── Add missing messages column ───────────────────────────────────
            conn.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_permanent_deleted BOOLEAN DEFAULT FALSE"))

            # Create message_groups table for custom superadmin groups
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS message_groups (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) UNIQUE NOT NULL,
                    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMPTZ DEFAULT now()
                )
            """))

            # Drop deprecated columns that cause NotNullViolations during inserts
            conn.execute(text("ALTER TABLE employees DROP COLUMN IF EXISTS is_active"))
            conn.execute(text("ALTER TABLE employees DROP COLUMN IF EXISTS department"))
            conn.execute(text("ALTER TABLE employees DROP COLUMN IF EXISTS date_joined"))
            conn.execute(text("ALTER TABLE employees DROP COLUMN IF EXISTS job_title"))
            conn.execute(text("ALTER TABLE employees DROP COLUMN IF EXISTS employee_number"))

            # Migrate data
            conn.execute(text("UPDATE employees SET email = REPLACE(email, '@hrm.local', '@hrm.com') WHERE email LIKE '%@hrm.local'"))
            conn.execute(text("UPDATE users SET email = REPLACE(email, '@hrm.local', '@hrm.com') WHERE email LIKE '%@hrm.local'"))
            conn.execute(text("UPDATE employees SET status = 'active' WHERE status IS NULL OR status NOT IN ('active', 'inactive')"))
    except Exception as e:
        print(f"Warning: Failed to auto-patch DB: {e}")

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
    yield
    email_task.cancel()
    holiday_task.cancel()
    try:
        await email_task
    except asyncio.CancelledError:
        pass
    try:
        await holiday_task
    except asyncio.CancelledError:
        pass
    print("[Email Poller] Background email polling stopped.")
    print("[Holiday Reminder] Background holiday reminder loop stopped.")


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
app.include_router(dashboard_router,     prefix="/dashboard",     tags=["Dashboard"])
app.include_router(messages_router,      prefix="/messages",      tags=["Messages"])
app.include_router(announcements_router, prefix="/announcements", tags=["Announcements"])
app.include_router(events_router,        prefix="/events",        tags=["Events"])
app.include_router(holidays_router,      prefix="/holidays",      tags=["Holidays"])
app.include_router(notifications_router, prefix="/notifications", tags=["Notifications"])
app.include_router(time_tracking_router, prefix="/time-tracking", tags=["Time Tracking"])

if _recruitment_available:
    app.include_router(recruitment_router)
    app.include_router(public_router)

# ── Document routers ───────────────────────────────────────────────────────────
app.include_router(documents_router,      tags=["Employee Documents"])
app.include_router(approval_router,       tags=["Document Approval"])
app.include_router(request_router,        tags=["Document Requests"])
app.include_router(hr_request_router,     tags=["HR Document Requests"])
app.include_router(template_router,       tags=["Document Templates"])
app.include_router(document_type_router,  tags=["Document Types"])

# ── Static file uploads ────────────────────────────────────────────────────────
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
