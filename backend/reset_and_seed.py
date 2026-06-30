from app.database.database import engine
from sqlalchemy import text
from app.database.base import Base
import json
from app.auth.models import User
from app.roles.models import Role
from app.announcements.models import Announcement
from app.events.models import Event
from app.time_tracking.models import TimeEntry
from sqlalchemy.orm import Session

def reset_db():
    print("Dropping and recreating all tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    with Session(engine) as db:
        # Create Roles
        admin_perms = [
            "widget.time_tracking.view", "widget.leave_balance.view", "widget.notifications.view",
            "widget.attendance.view", "widget.calendar.view", "widget.calendar.edit",
            "widget.approval_summary.view_approvals", "widget.approval_summary.view_requests",
            "widget.announcements.view", "widget.announcements.manage",
            "widget.upcoming_events.view", "widget.upcoming_events.manage",
            "messaging.send"
        ]
        emp_perms = [
            "widget.time_tracking.view", "widget.leave_balance.view", "widget.notifications.view",
            "widget.attendance.view", "widget.calendar.view", "widget.announcements.view",
            "widget.upcoming_events.view"
        ]

        admin_role = Role(name="Admin", permissions=admin_perms)
        hr_role = Role(name="HR Manager", permissions=admin_perms)
        emp_role = Role(name="Employee", permissions=emp_perms)
        
        db.add_all([admin_role, hr_role, emp_role])
        db.commit()

        db.commit()
        print("Database reset and roles seeded successfully.")
        print("Use the admin UI to create real users.")

if __name__ == "__main__":
    reset_db()
