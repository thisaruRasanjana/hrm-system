"""
leave/seed.py — Default leave types seeder.
Idempotent: inserts missing types and backfills missing entitlements.
"""
from sqlalchemy.orm import Session
from app.leave.models import LeaveType

# (name, description, annual entitlement in days)
DEFAULT_LEAVE_TYPES = [
    ("Annual", "Planned annual leave", 14.0),
    ("Casual", "Short-notice personal leave", 7.0),
    ("Medical", "Sick leave — requires supporting document", 7.0),
]


def seed_leave_types(db: Session) -> None:
    for name, description, default_days in DEFAULT_LEAVE_TYPES:
        existing = db.query(LeaveType).filter_by(name=name).first()
        if not existing:
            db.add(LeaveType(name=name, description=description, default_days=default_days))
        elif existing.default_days is None:
            existing.default_days = default_days
    db.commit()
