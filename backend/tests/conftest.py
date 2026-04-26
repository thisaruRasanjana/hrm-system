"""
tests/conftest.py
=================
Shared fixtures for backend unit tests.

Using SQLite in memory ensures tests are blazing fast and completely isolated
from the production PostgreSQL database.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.base import Base

# Use in-memory SQLite for tests to prevent touching the real DB
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db():
    """Provides a fresh database session for each test function."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        # Drop all tables after the test runs to ensure strict isolation
        Base.metadata.drop_all(bind=engine)
