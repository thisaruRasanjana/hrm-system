"""
leave/seed.py — Default leave types seeder.
Idempotent: only inserts types that don't already exist.
"""
from sqlalchemy.orm import Session
from app.leave.models import LeaveType

DEFAULT_LEAVE_TYPES = [
    ("Annual", "Planned annual leave"),
    ("Casual", "Short-notice personal leave"),
    ("Medical", "Sick leave — requires supporting document"),
]


def seed_leave_types(db: Session) -> None:
    for name, description in DEFAULT_LEAVE_TYPES:
        if not db.query(LeaveType).filter_by(name=name).first():
            db.add(LeaveType(name=name, description=description))
    db.commit()
