"""
departments/seed.py — Department seeding.

Departments are NOT hardcoded anymore: every company defines its own from the
UI (the department dropdown lets users add new ones, persisted via the API).
So a fresh system starts with an empty department list. This is kept as an
intentional no-op so the lifespan startup call remains valid.
"""
from sqlalchemy.orm import Session

# No default departments — companies create their own.
DEFAULT_DEPARTMENTS: list[str] = []


def seed_departments(db: Session) -> None:
    """Intentionally seeds nothing — departments are user-managed."""
    return
