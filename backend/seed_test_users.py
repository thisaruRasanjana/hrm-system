"""
seed_test_users.py
==================
Creates 4 test users for Recruitment module QA testing.
Each user has a different role so all permission paths can be tested.

Run from the backend/ directory:
    python3 seed_test_users.py

Safe to run multiple times — existing users are skipped (idempotent).
DO NOT commit this file to git.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.database.database import SessionLocal
from app.auth.models import User
from app.roles.models import Role
from app.core.security import hash_password

# ── Test user definitions ─────────────────────────────────────────────────────
# Format: (email, username, password, role_name, first_name, last_name)
TEST_USERS = [
    (
        "qa.hr@test.local",
        "qa_hr",
        "QATest@123",
        "HR",
        "Quinn",
        "HR",
    ),
    (
        "qa.manager@test.local",
        "qa_manager",
        "QATest@123",
        "Manager",
        "Max",
        "Manager",
    ),
    (
        "qa.panel@test.local",
        "qa_panel",
        "QATest@123",
        "Employee",          # base role — we add interview_panel permission separately
        "Paula",
        "Panel",
    ),
    (
        "qa.viewer@test.local",
        "qa_viewer",
        "QATest@123",
        "Employee",          # recruitment:view only — view-only access
        "Victor",
        "Viewer",
    ),
]

# ── Extra permissions to bolt on after role assignment ────────────────────────
# qa_panel needs recruitment:interview_panel added to their permission set.
# We do this by fetching the permission and adding it directly to the user's role
# link — but since roles are shared, we create a custom role instead.
PANEL_ROLE_NAME  = "QA Panel Member"
VIEWER_ROLE_NAME = "QA Viewer"


def get_or_create_role(db: Session, role_name: str, base_role_name: str, extra_permissions: list[str]) -> Role:
    """Create a custom role based on a base role, with extra permissions bolted on."""
    role = db.query(Role).filter_by(role_name=role_name).first()
    if role:
        print(f"  [SKIP] Role already exists: {role_name}")
        return role

    base = db.query(Role).filter_by(role_name=base_role_name).first()
    if not base:
        raise RuntimeError(f"Base role not found: {base_role_name}")

    from app.roles.models import Permission
    role = Role(role_name=role_name, description=f"QA-only custom role based on {base_role_name}")
    db.add(role)
    db.flush()

    # Copy base role permissions
    role.permissions = list(base.permissions)

    # Add extra permissions
    for perm_name in extra_permissions:
        perm = db.query(Permission).filter_by(permission_name=perm_name).first()
        if perm and perm not in role.permissions:
            role.permissions.append(perm)

    db.flush()
    print(f"  [OK]   Created custom role: {role_name}")
    return role


def seed():
    db: Session = SessionLocal()
    try:
        print("\n── Creating custom QA roles ──────────────────────────────────────────")

        # Panel Member role: Employee + recruitment:view + recruitment:interview_panel
        panel_role = get_or_create_role(
            db,
            role_name=PANEL_ROLE_NAME,
            base_role_name="Employee",
            extra_permissions=["recruitment:view", "recruitment:interview_panel"],
        )

        # Viewer role: Employee + recruitment:view only
        viewer_role = get_or_create_role(
            db,
            role_name=VIEWER_ROLE_NAME,
            base_role_name="Employee",
            extra_permissions=["recruitment:view"],
        )

        db.commit()

        print("\n── Seeding test users ───────────────────────────────────────────────")

        # Map special roles
        special_role_map = {
            "qa.panel@test.local": panel_role,
            "qa.viewer@test.local": viewer_role,
        }

        for email, username, password, role_name, first_name, last_name in TEST_USERS:
            existing = db.query(User).filter(User.email == email).first()
            if existing:
                print(f"  [SKIP] User already exists: {email}")
                continue

            # Resolve role
            if email in special_role_map:
                role = special_role_map[email]
            else:
                role = db.query(Role).filter_by(role_name=role_name).first()
                if not role:
                    print(f"  [ERROR] Role not found: {role_name}")
                    continue

            user = User(
                email=email,
                username=username,
                password_hash=hash_password(password),
                first_name=first_name,
                last_name=last_name,
                is_active=True,
                is_superadmin=False,
                role=role.role_name,
                role_id=role.id,
            )
            user.roles.append(role)
            db.add(user)
            db.flush()
            print(f"  [OK]   Created: {email}  (role: {role.role_name})")

        db.commit()
        print("\n✅ Done! See credentials below.\n")
        print_credentials()

    except Exception as e:
        db.rollback()
        print(f"\n❌ Error: {e}")
        raise
    finally:
        db.close()


def print_credentials():
    print("=" * 60)
    print("   QA TEST USER CREDENTIALS")
    print("=" * 60)
    print()
    print("1. HR Manager (full recruitment manage access)")
    print("   Email    : qa.hr@test.local")
    print("   Username : qa_hr")
    print("   Password : QATest@123")
    print("   Role     : HR  →  recruitment:manage, recruitment:view")
    print()
    print("2. Manager (no recruitment access — for AUTH tests)")
    print("   Email    : qa.manager@test.local")
    print("   Username : qa_manager")
    print("   Password : QATest@123")
    print("   Role     : Manager  →  no recruitment permissions")
    print()
    print("3. Panel Member (can evaluate interviews)")
    print("   Email    : qa.panel@test.local")
    print("   Username : qa_panel")
    print("   Password : QATest@123")
    print("   Role     : QA Panel Member  →  recruitment:view + recruitment:interview_panel")
    print()
    print("4. View-Only (can only read, never write)")
    print("   Email    : qa.viewer@test.local")
    print("   Username : qa_viewer")
    print("   Password : QATest@123")
    print("   Role     : QA Viewer  →  recruitment:view only")
    print()
    print("Login at: http://localhost:3000/login")
    print("=" * 60)


if __name__ == "__main__":
    seed()
