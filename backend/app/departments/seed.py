"""
departments/seed.py — Seeds default departments. Idempotent.
"""
from sqlalchemy.orm import Session
from app.departments.models import Department

DEFAULT_DEPARTMENTS = [
    "Human Resources",
    "Engineering",
    "Finance",
    "Marketing",
    "Sales",
    "Operations",
    "Design",
]


def seed_departments(db: Session) -> None:
    for name in DEFAULT_DEPARTMENTS:
        existing = db.query(Department).filter_by(name=name).first()
        if not existing:
            db.add(Department(name=name))
    db.commit()
