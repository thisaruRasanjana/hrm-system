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
            "widget.weekly_hours.view", "widget.calendar.view", "widget.calendar.edit",
            "widget.approval_summary.view_approvals", "widget.approval_summary.view_requests",
            "widget.announcements.view", "widget.announcements.manage",
            "widget.upcoming_events.view", "widget.upcoming_events.manage",
            "messaging.send"
        ]
        emp_perms = [
            "widget.time_tracking.view", "widget.leave_balance.view", "widget.notifications.view",
            "widget.weekly_hours.view", "widget.calendar.view", "widget.announcements.view",
            "widget.upcoming_events.view"
        ]

        admin_role = Role(name="Admin", permissions=admin_perms)
        hr_role = Role(name="HR Manager", permissions=admin_perms)
        emp_role = Role(name="Employee", permissions=emp_perms)
        
        db.add_all([admin_role, hr_role, emp_role])
        db.commit()

        # Create Dummy Users
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        
        users = [
            User(
                email="admin@hrm.lk", username="admin", 
                hashed_password=pwd_context.hash("Admin@123"), 
                role="Admin", role_id=admin_role.id, first_name="System", last_name="Admin",
                employee_id="EMP-001"
            ),
            User(
                email="hr@hrm.lk", username="hrmanager", 
                hashed_password=pwd_context.hash("HR@123"), 
                role="HR Manager", role_id=hr_role.id, first_name="HR", last_name="Manager",
                employee_id="EMP-002"
            ),
            User(
                email="emp@hrm.lk", username="employee1", 
                hashed_password=pwd_context.hash("Emp@123"), 
                role="Employee", role_id=emp_role.id, first_name="John", last_name="Doe",
                employee_id="EMP-003"
            ),
        ]
        db.add_all(users)
        db.commit()
        print("Database reset and seeded successfully.")

if __name__ == "__main__":
    reset_db()
