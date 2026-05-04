from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
import os

from app.database.database import engine, SessionLocal
from app.database.base import Base

# ── Import all models ──
import app.roles.models        # noqa: F401
import app.auth.models         # noqa: F401
import app.departments.models  # noqa: F401
import app.employees.models    # noqa: F401
import app.time_tracking.models # noqa: F401
import app.messages.models      # noqa: F401
import app.announcements.models # noqa: F401
import app.events.models        # noqa: F401
import app.notifications.models # noqa: F401
import app.calendar_holidays.models # noqa: F401
import app.dashboard.models    # noqa: F401

# ── Routers ────────────────────────────────────────────────────────────────────
from app.auth.router        import router as auth_router
from app.roles.router       import router as roles_router
from app.employees.router   import router as employee_router
from app.leave.router       import router as leave_router
from app.departments.router import router as departments_router
from app.dashboard.router   import router as dashboard_router
from app.messages.router    import router as messages_router
from app.announcements.router import router as announcements_router
from app.events.router      import router as events_router
from app.calendar_holidays.router import router as holidays_router
from app.notifications.router import router as notifications_router
from app.time_tracking.router import router as time_tracking_router

# ── Seed helpers ───────────────────────────────────────────────────────────────
from app.roles.seed       import seed_roles
from app.departments.seed import seed_departments


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    
    from sqlalchemy import text
    try:
        with engine.begin() as conn:
            # Add missing columns
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
        seed_departments(db)
        seed_roles(db)
        try:
            from app.calendar_holidays.router import seed_holidays
            seed_holidays()
        except Exception as e:
            print(f"[WARNING] seed_holidays skipped: {e}")
    finally:
        db.close()
    yield


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

# ── Static file uploads ────────────────────────────────────────────────────────
os.makedirs("uploads/profiles", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ── Root ───────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"message": "HRM System API v2.0 — Role-based permissions active"}

security_bearer = HTTPBearer()

@app.get("/protected")
def protected_route(credentials: HTTPAuthorizationCredentials = Depends(security_bearer)):
    return {"message": "Authorized", "token": credentials.credentials}
