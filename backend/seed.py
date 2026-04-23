"""
seed.py -- Creates 3 roles and 3 dummy users for testing.
Run AFTER migrate.py (which creates the roles table).

Usage:  python seed.py

Idempotent -- skips existing records.
"""
# -*- coding: utf-8 -*-

import os, sys

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from app.database.database import SessionLocal
from app.core.security import hash_password
from app.core.permissions import ALL_PERMISSIONS, HR_PERMISSIONS, EMPLOYEE_PERMISSIONS
from app.roles.models import Role
from app.auth.models import User

db = SessionLocal()


def get_or_create_role(name: str, permissions: list) -> Role:
    existing = db.query(Role).filter(Role.name == name).first()
    if existing:
        print(f"  Role '{name}' already exists -- updating permissions.")
        existing.permissions = permissions
        db.commit()
        return existing
    role = Role(name=name, permissions=permissions)
    db.add(role)
    db.commit()
    db.refresh(role)
    print(f"  [OK] Created role '{name}' with {len(permissions)} permissions.")
    return role


print("\n-- Creating roles --")
admin_role = get_or_create_role("Admin", ALL_PERMISSIONS)
hr_role    = get_or_create_role("HR Manager", HR_PERMISSIONS)
emp_role   = get_or_create_role("Employee", EMPLOYEE_PERMISSIONS)

dummy_users = [
    {
        "email": "admin@hrm.lk",
        "username": "admin",
        "password": "Admin@123",
        "first_name": "Admin",
        "last_name": "User",
        "role": "Admin",
        "position": "System Administrator",
        "department": "Management",
        "employee_id": "EMP-ADMIN",
        "role_id": admin_role.id,
    },
    {
        "email": "hr@hrm.lk",
        "username": "hrmanager",
        "password": "HR@123",
        "first_name": "HR",
        "last_name": "Manager",
        "role": "HR Manager",
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
        print(f"  User '{u['username']}' already exists -- updating role_id and password.")
        existing.role_id = u["role_id"]
        existing.role = u["role"]
        existing.username = u["username"]
        existing.hashed_password = hash_password(u["password"])
        db.commit()
        continue

    user = User(
        email=u["email"],
        username=u["username"],
        hashed_password=hash_password(u["password"]),
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
print("  Login credentials:")
print("  Username: admin      | Password: Admin@123  | Role: Admin")
print("  Username: hrmanager  | Password: HR@123     | Role: HR Manager")
print("  Username: employee1  | Password: Emp@123    | Role: Employee")
