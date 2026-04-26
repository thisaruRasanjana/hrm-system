"""
app/database/database.py
------------------------
Database engine and session factory.

The DATABASE_URL is read from the environment (.env file via python-dotenv).
Falls back to component-based construction from individual DB_* variables so
the app can run with either a full URL or individual credentials.

WHY engine is None-safe:
  In unit tests, this module is imported before the test override is applied.
  Allowing engine=None lets the app import cleanly; tests inject their own
  session via FastAPI dependency_overrides.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from dotenv import load_dotenv

load_dotenv()

# Build DATABASE_URL from a single env var or from individual components.
DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    (
        f"postgresql://{os.getenv('DB_USER', 'postgres')}:"
        f"{os.getenv('DB_PASSWORD', 'postgres')}"
        f"@{os.getenv('DB_HOST', 'localhost')}:"
        f"{os.getenv('DB_PORT', '5432')}/{os.getenv('DB_NAME', 'hrm_db')}"
    ),
)

# Create the engine; set engine=None on failure so the app can still import.
try:
    engine = create_engine(DATABASE_URL, echo=False)
except Exception as exc:
    print(f"Failed to create database engine: {exc}")
    engine = None

# Session factory — None when the engine is unavailable.
SessionLocal = (
    sessionmaker(autocommit=False, autoflush=False, bind=engine)
    if engine is not None
    else None
)


def get_db():
    """
    FastAPI dependency that yields a DB session per request.

    The session is always closed in the finally block, even if an exception
    is raised during request handling. This prevents connection leaks.
    """
    if SessionLocal is None:
        raise RuntimeError(
            "Database session is unavailable — engine creation failed. "
            "Check your DATABASE_URL / DB_* environment variables."
        )

    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()