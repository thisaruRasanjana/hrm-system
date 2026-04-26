"""
HRM Backend — Application Entry Point

Registers all middleware, routes, and startup/shutdown lifecycle hooks.
All module-specific logic lives in its own router; this file is kept intentionally thin.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import CORS_ORIGINS
from app.database.database import engine
from app.database.base import Base
from app.recruitment.router import router as recruitment_router
from app.recruitment.public_router import router as public_router
from app.employees.router import router as employees_router

# Use the standard library logger so output integrates with any log aggregator.
logger = logging.getLogger(__name__)


# ── Lifespan (replaces deprecated @app.on_event) ──────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifecycle manager.

    On startup: verify the database connection and create any missing tables.
    The try/except allows the app to start even when the DB is temporarily
    unavailable (e.g. during a rolling restart) — the first real request
    will surface the error clearly.
    """
    try:
        with engine.connect():
            logger.info("Database connection established successfully.")
        Base.metadata.create_all(bind=engine)
        logger.info("Database schema synchronised.")
    except Exception as exc:
        # Log the full error but do NOT crash — let health checks surface it.
        logger.warning("Database connection failed on startup: %s", exc)

    yield  # Application runs here.

    logger.info("HRM backend shutting down.")


# ── Application instance ───────────────────────────────────────────────────────

app = FastAPI(
    title="HRM Backend",
    description="Human Resource Management System — internal API.",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────────
# Origins are loaded from config (which reads CORS_ORIGINS from .env),
# so no values are hardcoded here.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(recruitment_router)
app.include_router(public_router)
app.include_router(employees_router)


# ── Root health check ──────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    """Liveness probe — returns 200 when the application is running."""
    return {"status": "ok", "service": "hrm-backend"}