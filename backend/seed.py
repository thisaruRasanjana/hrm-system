"""
seed.py -- Creates 3 dummy users for testing.
Assumes roles are already seeded by app startup.

Usage:  python seed.py
"""
# -*- coding: utf-8 -*-

import os, sys

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from app.database.database import SessionLocal
from app.core.security import hash_password
from app.roles.models import Role
from app.auth.models import User
from app.employees.models import Employee # noqa: F401
from app.departments.models import Department # noqa: F401
from app.announcements.models import Announcement # noqa: F401
from app.events.models import Event # noqa: F401
from app.time_tracking.models import TimeEntry # noqa: F401
from app.messages.models import Message # noqa: F401
from app.notifications.models import Notification # noqa: F401

db = SessionLocal()

def get_role(name: str) -> Role:
    role = db.query(Role).filter(Role.role_name == name).first()
    if not role:
        print(f"  [ERROR] Role '{name}' not found. Make sure backend has run once to seed roles.")
        sys.exit(1)
    return role

print("\n-- Fetching roles --")
super_admin_role = get_role("Super Admin")
hr_role          = get_role("HR")
emp_role         = get_role("Employee")

print("\n-- Fixing Dashboard Widget Permissions --")
from app.roles.models import Permission
dashboard_perms = [
    "widget.announcements.view", "widget.announcements.manage",
    "widget.upcoming_events.view", "widget.upcoming_events.manage",
    "widget.calendar.view", "widget.calendar.edit",
    "widget.time_tracking.view", "widget.leave_balance.view",
    "widget.approval_summary.view_approvals", "widget.approval_summary.view_requests",
    "widget.notifications.view", "widget.weekly_hours.view", "widget.availability.view"
]

for p_name in dashboard_perms:
    p = db.query(Permission).filter(Permission.permission_name == p_name).first()
    if not p:
        p = Permission(permission_name=p_name, description="Dashboard Widget Access")
        db.add(p)
        db.commit()
        db.refresh(p)
    
    if p not in super_admin_role.permissions:
        super_admin_role.permissions.append(p)
    if p not in hr_role.permissions:
        hr_role.permissions.append(p)
    if p_name.endswith(".view") and p not in emp_role.permissions:
        emp_role.permissions.append(p)

db.commit()

print("\n-- Skipping dummy user creation (hardcoded test accounts removed) --")
print("    Use the admin UI to create real users.")

db.close()
print("\nSeed complete.\n")
