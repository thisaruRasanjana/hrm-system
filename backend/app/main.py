from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles

from app.database.database import engine
from app.database.base import Base

# ── Routers ─────────────────────────────────────────────────────────────────────
from app.auth.router import router as auth_router
from app.dashboard.router import router as dashboard_router
from app.messages.router import router as messages_router
from app.announcements.router import router as announcements_router
from app.events.router import router as events_router
from app.calendar_holidays.router import router as holidays_router
from app.notifications.router import router as notifications_router
from app.leave.router import router as leave_router
from app.roles.router import router as roles_router
from app.time_tracking.router import router as time_tracking_router

# ── Import models so SQLAlchemy registers tables (order matters for FKs) ────────
from app.roles import models as roles_models          # roles (no FKs)
from app.auth import models                           # users (FK → roles)
from app.dashboard import models as dashboard_models
from app.messages import models as messages_models
from app.announcements import models as announcements_models
from app.events import models as events_models
from app.calendar_holidays import models as holidays_models
from app.notifications import models as notifications_models
from app.time_tracking import models as time_tracking_models

# ── Create all tables ────────────────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)

# ── App ─────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="HRM System API",
    version="2.0.0",
    description="Role-based HRM System — permissions managed via /roles/"
)

@app.on_event("startup")
def startup_event():
    from app.calendar_holidays.router import seed_holidays
    seed_holidays()

# ── CORS ────────────────────────────────────────────────────────────────────────
# NOTE: allow_credentials=True requires explicit origins — cannot use ["*"] with credentials.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register API routers ─────────────────────────────────────────────────────────
app.include_router(auth_router,          prefix="/auth",          tags=["Authentication"])
app.include_router(roles_router,         prefix="/roles",         tags=["Roles & Permissions"])
app.include_router(dashboard_router,     prefix="/dashboard",     tags=["Dashboard"])
app.include_router(messages_router,      prefix="/messages",      tags=["Messages"])
app.include_router(announcements_router, prefix="/announcements", tags=["Announcements"])
app.include_router(events_router,        prefix="/events",        tags=["Events"])
app.include_router(holidays_router,      prefix="/holidays",      tags=["Holidays"])
app.include_router(notifications_router, prefix="/notifications", tags=["Notifications"])
app.include_router(leave_router,         prefix="/leave",         tags=["Leave"])
app.include_router(time_tracking_router, prefix="/time-tracking", tags=["Time Tracking"])

# ── Static files ─────────────────────────────────────────────────────────────────
import os
os.makedirs("uploads/profiles", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ── Root ─────────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"message": "HRM System API v2.0 — Role-based permissions active"}

security = HTTPBearer()

@app.get("/protected")
def protected_route(credentials: HTTPAuthorizationCredentials = Depends(security)):
    return {"message": "Authorized", "token": credentials.credentials}