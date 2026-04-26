# ─── IMPORTANT: Patch PostgreSQL ARRAY before importing any app models ────────
# SQLite does not support ARRAY. We replace it with JSON for test compatibility.
import sqlalchemy.dialects.postgresql as _pg
from sqlalchemy.types import JSON as _JSON

_pg.ARRAY = lambda *args, **kwargs: _JSON()
# ─────────────────────────────────────────────────────────────────────────────

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from datetime import date, timedelta
from starlette.testclient import TestClient

from app.database.base import Base
from app.leave.models import LeaveRequest, LeaveType
from app.employees.models import Employee

# ---------------------------------------------------------------------------
# In-memory SQLite engine — ONE engine for the whole session.
# autouse=True guarantees tables exist before any test in any file runs.
# ---------------------------------------------------------------------------
TEST_DATABASE_URL = "sqlite:///:memory:"

# Create the engine eagerly at import time so all fixtures share it.
_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)


@event.listens_for(_engine, "connect")
def _register_concat(dbapi_conn, _):
    """Register CONCAT as a SQLite user-defined function."""
    dbapi_conn.create_function(
        "concat",
        -1,
        lambda *args: "".join(str(a) for a in args if a is not None),
    )


# Build all tables once, immediately.
Base.metadata.create_all(bind=_engine)


@pytest.fixture(scope="session")
def engine():
    """Expose the shared engine to tests that need it directly."""
    return _engine


# ---------------------------------------------------------------------------
# DB session fixture — uses nested transaction (savepoint) for full isolation
# even when service functions call db.commit() internally.
# ---------------------------------------------------------------------------
@pytest.fixture
def db():
    """Provide a test session that is fully rolled back after each test."""
    connection = _engine.connect()
    # Begin an outer transaction — never committed.
    trans = connection.begin()
    Session = sessionmaker(autocommit=False, autoflush=False, bind=connection)
    session = Session()
    # Begin a savepoint so inner commits don't break the outer transaction.
    session.begin_nested()

    yield session

    session.close()
    trans.rollback()   # undo everything, including any inner commits
    connection.close()



# ---------------------------------------------------------------------------
# Seed helpers (functions, not fixtures — call them directly inside tests)
# ---------------------------------------------------------------------------
_counter = 0


def _uid() -> int:
    global _counter
    _counter += 1
    return _counter


def make_employee(db, *, first_name="John", last_name="Doe", roles=None):
    """Insert and flush a minimal Employee row."""
    uid = _uid()
    emp = Employee(
        employee_id=f"EMP{uid:05d}",
        first_name=first_name,
        last_name=last_name,
        email=f"user{uid}@example.com",
        phone="0771234567",
        department="Engineering",
        designation="Software Engineer",
        roles=roles or ["employee"],
    )
    db.add(emp)
    db.flush()
    return emp


def make_leave_type(db, name="Annual Leave", description=None):
    """Get-or-create a LeaveType row (avoids UNIQUE collision across tests)."""
    existing = db.query(LeaveType).filter(LeaveType.name == name).first()
    if existing:
        return existing
    lt = LeaveType(name=name, description=description)
    db.add(lt)
    db.flush()
    return lt


def make_leave_request(
    db,
    *,
    employee_id,
    leave_type_id,
    start_date=None,
    end_date=None,
    status="PENDING",
    total_days=1.0,
    half_day=False,
    reason="Test reason",
    attachment_urls=None,
):
    """Insert and flush a LeaveRequest row."""
    today = date.today()
    req = LeaveRequest(
        employee_id=employee_id,
        leave_type_id=leave_type_id,
        start_date=start_date or today,
        end_date=end_date or (start_date or today),
        total_days=total_days,
        half_day=half_day,
        status=status,
        reason=reason,
        attachment_urls=attachment_urls or [],
    )
    db.add(req)
    db.flush()
    return req


# ---------------------------------------------------------------------------
# FastAPI TestClient with DB override
# ---------------------------------------------------------------------------
@pytest.fixture
def client(db):
    """TestClient that uses the test SQLite session instead of the real DB."""
    from app.main import app
    from app.database.database import get_db

    def _override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Reusable auth header dicts
# ---------------------------------------------------------------------------
EMPLOYEE_HEADERS = {"x-user-id": "1", "x-user-roles": "employee"}
HR_HEADERS = {"x-user-id": "99", "x-user-roles": "hr"}
