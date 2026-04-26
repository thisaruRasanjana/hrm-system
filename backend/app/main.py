"""
app/main.py
-----------
FastAPI application entry point.

Responsibilities:
  - Create the FastAPI app instance with metadata.
  - Mount static file directory for uploaded documents.
  - Register CORS middleware.
  - Wire up all domain routers.
  - Run a DB connectivity check at startup.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database.database import engine
from app.database.base import Base

# Import models so SQLAlchemy registers them before create_all.
from app.leave import models as leave_models          # noqa: F401
from app.employees import models as employee_models   # noqa: F401
from app.auth import models as auth_models            # noqa: F401

from app.leave.router import router as leave_router
from app.reports.router import router as reports_router

# ---------------------------------------------------------------------------
# Lifespan — replaces the deprecated @app.on_event("startup") pattern.
# WHY: FastAPI v0.93+ recommends the lifespan context manager. It is also
# more testable — the startup/shutdown logic runs within the test client.
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create DB tables and verify connectivity on startup."""
    if engine is None:
        print("WARNING: Database engine not initialised — check .env settings")
    else:
        try:
            Base.metadata.create_all(bind=engine)
            with engine.connect():
                pass  # Connectivity check only
            print("Database connected successfully")
        except Exception as exc:
            print(f"Database connection failed: {exc}")
    yield  # Application runs here
    # Shutdown logic (if needed) goes after yield.


# ---------------------------------------------------------------------------
# Application instance
# ---------------------------------------------------------------------------
app = FastAPI(
    title="HRM Backend",
    description="Human Resource Management System API",
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Static files and middleware
# ---------------------------------------------------------------------------
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ---------------------------------------------------------------------------
# CORS — restrict to the local frontend dev servers.
# WHY: allow_origins=["*"] in production is a security risk; explicit origins
# are safer and still support both localhost variants.
# ---------------------------------------------------------------------------
_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)




# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(leave_router)
app.include_router(reports_router)

# ---------------------------------------------------------------------------
# Health / root endpoints
# ---------------------------------------------------------------------------

@app.get("/", tags=["Health"])
def root() -> dict:
    """Root endpoint — confirms the API is running."""
    return {"message": "HRM API is running", "docs": "/docs"}


@app.get("/health", tags=["Health"])
def health() -> dict:
    """Health check endpoint used by monitoring tools."""
    return {"status": "ok"}