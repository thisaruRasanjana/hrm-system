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

EMAIL_POLL_INTERVAL = 60

async def email_polling_loop():
    await asyncio.sleep(5)
    while True:
        try:
            from app.documents.services import email_service
            db = SessionLocal()
            result = await asyncio.to_thread(email_service.fetch_and_process_external_requests, db)
            db.close()
            if isinstance(result, int) and result > 0:
                print(f"[Email Poller] Synced {result} new external email request(s).")
            elif isinstance(result, dict) and result.get("status") == "error":
                print(f"[Email Poller] Service Error: {result.get('message')}")
        except Exception as e:
            print(f"[Email Poller] Loop Error: {e}")
        await asyncio.sleep(EMAIL_POLL_INTERVAL)

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

            # ── Patch employees table with columns added in dev branch ───────
            conn.execute(text("ALTER TABLE employees ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id)"))
            conn.execute(text("ALTER TABLE employees ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)"))
            conn.execute(text("ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE"))

            # ── Patch permissions table (dev uses permission_name, resource, action) ──
            conn.execute(text("ALTER TABLE permissions ADD COLUMN IF NOT EXISTS permission_name VARCHAR(255)"))
            conn.execute(text("ALTER TABLE permissions ADD COLUMN IF NOT EXISTS resource VARCHAR(100)"))
            conn.execute(text("ALTER TABLE permissions ADD COLUMN IF NOT EXISTS action VARCHAR(100)"))
            conn.execute(text("ALTER TABLE permissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()"))
            # Copy existing 'name' into 'permission_name' where not already set
            conn.execute(text("""
                UPDATE permissions
                SET permission_name = name
                WHERE permission_name IS NULL AND name IS NOT NULL
            """))

            # ── Patch roles table (dev uses role_name) ────────────────────────
            conn.execute(text("ALTER TABLE roles ADD COLUMN IF NOT EXISTS role_name VARCHAR(100)"))
            conn.execute(text("ALTER TABLE roles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()"))
            # Copy existing 'name' into 'role_name' where not already set
            conn.execute(text("""
                UPDATE roles
                SET role_name = name
                WHERE role_name IS NULL AND name IS NOT NULL
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
            from app.calendar_holidays.router import seed_holidays
            seed_holidays()
        except Exception as e:
            print(f"[WARNING] seed_holidays skipped: {e}")
    finally:
        db.close()

    email_task = asyncio.create_task(email_polling_loop())
    print("[Email Poller] Background email polling started (every 60 seconds).")
    yield
    email_task.cancel()
    try:
        await email_task
    except asyncio.CancelledError:
        pass
    print("[Email Poller] Background email polling stopped.")


app = FastAPI(
    title="HRM System API",
    version="2.0.0",
    description="Role-based HRM System — permissions managed via /roles/",
    lifespan=lifespan,
    redirect_slashes=False,
)

# ── CORS ───────────────────────────────────────────────────────────────────────
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

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
app.include_router(leave_router,         prefix="/leave",         tags=["Leave"])
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
