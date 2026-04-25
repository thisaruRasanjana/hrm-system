import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles

import app.announcements.models  # noqa: F401
import app.auth.models  # noqa: F401
import app.calendar_holidays.models  # noqa: F401
import app.dashboard.models  # noqa: F401
import app.departments.models  # noqa: F401
import app.documents.models.document_type_model  # noqa: F401

# Document module model imports
import app.documents.models.model  # noqa: F401
import app.documents.models.request_model  # noqa: F401
import app.documents.models.template_model  # noqa: F401
import app.employees.models  # noqa: F401
import app.events.models  # noqa: F401
import app.messages.models  # noqa: F401
import app.notifications.models  # noqa: F401

# ── Import all models so SQLAlchemy metadata is populated ──
import app.roles.models  # noqa: F401
import app.time_tracking.models  # noqa: F401
from app.announcements.router import router as announcements_router

# ── Routers ────────────────────────────────────────────────────────────────────
from app.auth.router import router as auth_router
from app.calendar_holidays.router import router as holidays_router
from app.dashboard.router import router as dashboard_router
from app.database.base import Base
from app.database.database import SessionLocal, engine
from app.departments.router import router as departments_router
from app.departments.seed import seed_departments
from app.documents.routers import request_router
from app.documents.routers.approval_router import router as approval_router
from app.documents.routers.document_type_router import router as document_type_router
from app.documents.routers.hr_own_document_router import (
    router as hr_own_document_router,
)
from app.documents.routers.hr_request_router import router as hr_request_router

# Document module routers
from app.documents.routers.router import router as documents_router
from app.documents.routers.template_router import router as template_router
from app.employees.router import router as employee_router
from app.events.router import router as events_router
from app.leave.router import router as leave_router
from app.messages.router import router as messages_router
from app.notifications.router import router as notifications_router
from app.roles.router import router as roles_router

# ── Seed helpers ───────────────────────────────────────────────────────────────
from app.roles.seed import seed_roles
from app.time_tracking.router import router as time_tracking_router

EMAIL_POLL_INTERVAL = 60  # seconds between each email check


async def email_polling_loop():
    """Runs in the background and polls Gmail inbox every EMAIL_POLL_INTERVAL seconds."""
    await asyncio.sleep(5)
    while True:
        try:
            from app.documents.services import email_service

            db = SessionLocal()
            result = email_service.fetch_and_process_external_requests(db)
            db.close()
            if result.get("processed_emails", 0) > 0:
                print(
                    f"[Email Poller] Synced {result['processed_emails']} new external email request(s)."
                )
        except Exception as e:
            print(f"[Email Poller] Error: {e}")
        await asyncio.sleep(EMAIL_POLL_INTERVAL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create all tables then run seed functions on startup."""
    # Auto-create any tables that don't exist yet
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        seed_departments(db)
        seed_roles(db)
        # Seed calendar holidays
        try:
            from app.calendar_holidays.router import seed_holidays

            seed_holidays()
        except Exception as e:
            print(f"[WARNING] seed_holidays skipped: {e}")
    finally:
        db.close()

    # Start background tasks
    task = asyncio.create_task(email_polling_loop())
    print("[Email Poller] Background email polling started (every 60 seconds).")

    yield

    # Stop background tasks
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    print("[Email Poller] Background email polling stopped.")


app = FastAPI(
    title="HRM System API",
    version="2.0.0",
    description="Role-based HRM System with Document Management",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register API routers ──
app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
app.include_router(roles_router, prefix="/roles", tags=["Roles & Permissions"])
app.include_router(employee_router, prefix="/employees", tags=["Employees"])
app.include_router(leave_router, prefix="/leave", tags=["Leave"])
app.include_router(departments_router, prefix="/departments", tags=["Departments"])
app.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"])
app.include_router(messages_router, prefix="/messages", tags=["Messages"])
app.include_router(
    announcements_router, prefix="/announcements", tags=["Announcements"]
)
app.include_router(events_router, prefix="/events", tags=["Events"])
app.include_router(holidays_router, prefix="/holidays", tags=["Holidays"])
app.include_router(
    notifications_router, prefix="/notifications", tags=["Notifications"]
)
app.include_router(
    time_tracking_router, prefix="/time-tracking", tags=["Time Tracking"]
)

# Document module routers
app.include_router(documents_router, prefix="/documents", tags=["Documents"])
app.include_router(
    request_router.router, prefix="/document-requests", tags=["Document Requests"]
)
app.include_router(
    hr_request_router, prefix="/hr-document-requests", tags=["HR Document Requests"]
)
app.include_router(hr_own_document_router, tags=["HR Own Documents"])
app.include_router(
    approval_router, prefix="/documents/review", tags=["Document Approval"]
)
app.include_router(template_router, prefix="/document-templates", tags=["Templates"])
app.include_router(
    document_type_router, prefix="/api/document-types", tags=["Document Types"]
)

# ── Static file uploads ────────────────────────────────────────────────────────
os.makedirs("uploads/profiles", exist_ok=True)
os.makedirs("uploads/documents", exist_ok=True)
os.makedirs("uploads/templates", exist_ok=True)
os.makedirs("uploads/generated_documents", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


# ── Root ───────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "message": "HRM System API v2.0 — Role-based permissions & Documents active"
    }


security_bearer = HTTPBearer()


@app.get("/protected")
def protected_route(
    credentials: HTTPAuthorizationCredentials = Depends(security_bearer),
):
    return {"message": "Authorized", "token": credentials.credentials}
