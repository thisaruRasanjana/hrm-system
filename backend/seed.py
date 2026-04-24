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

dummy_users = [
    {
        "email": "admin@hrm.lk",
        "username": "admin",
        "password": "Admin@123",
        "first_name": "Admin",
        "last_name": "User",
        "role": "Super Admin",
        "position": "System Administrator",
        "department": "Management",
        "employee_id": "EMP-ADMIN",
        "role_id": super_admin_role.id,
    },
    {
        "email": "hr@hrm.lk",
        "username": "hrmanager",
        "password": "HR@123",
        "first_name": "HR",
        "last_name": "Manager",
        "role": "HR",
        "position": "HR Manager",
        "department": "Human Resources",
        "employee_id": "EMP-001",
        "role_id": hr_role.id,
    },
    {
        "email": "emp@hrm.lk",
        "username": "employee1",
        "password": "Emp@123",
        "first_name": "John",
        "last_name": "Employee",
        "role": "Employee",
        "position": "Software Engineer",
        "department": "Engineering",
        "employee_id": "EMP-002",
        "role_id": emp_role.id,
    },
]

print("\n-- Creating dummy users --")
for u in dummy_users:
    existing = (
        db.query(User).filter(User.email == u["email"]).first()
        or db.query(User).filter(User.username == u["username"]).first()
    )
    if existing:
        print(f"  User '{u['username']}' already exists -- updating role and password.")
        existing.role_id = u["role_id"]
        existing.role = u["role"]
        existing.username = u["username"]
        existing.password_hash = hash_password(u["password"])
        db.commit()
        continue

    user = User(
        email=u["email"],
        username=u["username"],
        password_hash=hash_password(u["password"]),
        first_name=u["first_name"],
        last_name=u["last_name"],
        role=u["role"],
        position=u["position"],
        department=u["department"],
        employee_id=u["employee_id"],
        role_id=u["role_id"],
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    print(f"  [OK] Created user '{u['username']}' ({u['email']}) -- role: {u['role']}")

db.close()
print("\nSeed complete.\n")
