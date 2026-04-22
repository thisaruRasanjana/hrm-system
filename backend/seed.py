"""
seed.py - Database seed script for document management module.

Inserts roles, permissions, and test employees required for the
document management RBAC system.

Usage:
    python seed.py          (from the backend root folder)

Idempotent: safe to run multiple times -- existing records are skipped.
"""

import sys
import io
from datetime import date
from sqlalchemy.orm import Session

# Force UTF-8 output so the terminal does not choke on any characters
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# ---------------------------------------------------------------------------
# Bootstrap: app package must be importable from the backend root
# ---------------------------------------------------------------------------
from app.database.database import SessionLocal          # noqa: E402
from app.auth.models import Role, Permission            # noqa: E402
from app.employees.models import Employee, EmployeeStatus  # noqa: E402


# ===========================================================================
# Data definitions
# ===========================================================================

PERMISSIONS = [
    {
        "name": "document:upload",
        "description": "Upload own documents",
    },
    {
        "name": "document:request",
        "description": "Request documents like service letter",
    },
    {
        "name": "document:approve",
        "description": "Approve or reject documents",
    },
    {
        "name": "document:manage_requests",
        "description": "Manage document requests",
    },
    {
        "name": "document:manage_types",
        "description": "Manage document types",
    },
    {
        "name": "document:manage_templates",
        "description": "Manage document templates",
    },
]

ROLES = [
    {
        "name": "employee",
        "description": "Regular employee with basic document access",
        "is_system": 1,
        "permissions": [
            "document:upload",
            "document:request",
        ],
    },
    {
        "name": "manager",
        "description": "Manager who can approve documents",
        "is_system": 1,
        "permissions": [
            "document:upload",
            "document:request",
            "document:approve",
        ],
    },
    {
        "name": "hr",
        "description": "HR staff with full document management access",
        "is_system": 1,
        "permissions": [
            "document:upload",
            "document:request",
            "document:approve",
            "document:manage_requests",
            "document:manage_types",
            "document:manage_templates",
        ],
    },
    {
        "name": "super_admin",
        "description": "Super admin with full administrative document control",
        "is_system": 1,
        "permissions": [
            "document:approve",
            "document:manage_requests",
            "document:manage_types",
            "document:manage_templates",
        ],
    },
]

# One test employee per role
TEST_EMPLOYEES = [
    {
        "role_name": "employee",
        "employee_id": "TEST-EMP-001",
        "first_name": "Test",
        "last_name": "Employee",
        "email": "test.employee@hrm.local",
        "phone": "0000000001",
        "department": "General",
        "designation": "Staff",
    },
    {
        "role_name": "manager",
        "employee_id": "TEST-MGR-001",
        "first_name": "Test",
        "last_name": "Manager",
        "email": "test.manager@hrm.local",
        "phone": "0000000002",
        "department": "General",
        "designation": "Manager",
    },
    {
        "role_name": "hr",
        "employee_id": "TEST-HR-001",
        "first_name": "Test",
        "last_name": "HR",
        "email": "test.hr@hrm.local",
        "phone": "0000000003",
        "department": "Human Resources",
        "designation": "HR Officer",
    },
    {
        "role_name": "super_admin",
        "employee_id": "TEST-SA-001",
        "first_name": "Test",
        "last_name": "SuperAdmin",
        "email": "test.superadmin@hrm.local",
        "phone": "0000000004",
        "department": "Administration",
        "designation": "Super Administrator",
    },
]


# ===========================================================================
# Colour helpers (ANSI codes -- safe on both Windows Terminal and plain CMD)
# ===========================================================================

def _green(msg: str) -> str:
    return f"\033[92m{msg}\033[0m"


def _yellow(msg: str) -> str:
    return f"\033[93m{msg}\033[0m"


def _red(msg: str) -> str:
    return f"\033[91m{msg}\033[0m"


def _bold(msg: str) -> str:
    return f"\033[1m{msg}\033[0m"


# ===========================================================================
# Seed functions
# ===========================================================================

def seed_permissions(db: Session) -> dict:
    """Insert permissions; skip if already present. Returns name->Permission map."""
    print(_bold("\n-- Permissions ---------------------------------------"))
    perm_map = {}

    for pdef in PERMISSIONS:
        existing = db.query(Permission).filter(Permission.name == pdef["name"]).first()
        if existing:
            print(_yellow(f"  SKIP   permission '{pdef['name']}' (already exists, id={existing.id})"))
            perm_map[existing.name] = existing
        else:
            perm = Permission(name=pdef["name"], description=pdef["description"])
            db.add(perm)
            db.flush()  # obtain auto-generated id without committing yet
            print(_green(f"  CREATE permission '{perm.name}' (id={perm.id})"))
            perm_map[perm.name] = perm

    return perm_map


def seed_roles(db: Session, perm_map: dict) -> dict:
    """Insert roles with their permissions; skip if already present."""
    print(_bold("\n-- Roles ---------------------------------------------"))
    role_map = {}

    for rdef in ROLES:
        existing = db.query(Role).filter(Role.name == rdef["name"]).first()
        if existing:
            print(_yellow(f"  SKIP   role '{rdef['name']}' (already exists, id={existing.id})"))
            role_map[existing.name] = existing
        else:
            role = Role(
                name=rdef["name"],
                description=rdef["description"],
                is_system=rdef["is_system"],
            )
            for pname in rdef["permissions"]:
                if pname in perm_map:
                    role.permissions.append(perm_map[pname])
                else:
                    print(_red(f"  WARN   permission '{pname}' not found for role '{rdef['name']}'"))

            db.add(role)
            db.flush()
            pnames = ", ".join(rdef["permissions"])
            print(_green(f"  CREATE role '{role.name}' (id={role.id}) -> [{pnames}]"))
            role_map[role.name] = role

    return role_map


def seed_test_employees(db: Session, role_map: dict) -> list:
    """Create one test employee per role; skip if employee_id already exists."""
    print(_bold("\n-- Test Employees ------------------------------------"))
    created = []

    for edef in TEST_EMPLOYEES:
        existing = db.query(Employee).filter(Employee.employee_id == edef["employee_id"]).first()
        if existing:
            print(_yellow(
                f"  SKIP   employee '{edef['employee_id']}' "
                f"({edef['first_name']} {edef['last_name']}) already exists -- db id={existing.id}"
            ))
            created.append({
                "role": edef["role_name"],
                "employee_id_field": existing.employee_id,
                "db_id": existing.id,
                "name": f"{existing.first_name} {existing.last_name}",
                "skipped": True,
            })
            continue

        role = role_map.get(edef["role_name"])
        if not role:
            print(_red(f"  ERROR  role '{edef['role_name']}' not found -- skipping {edef['employee_id']}"))
            continue

        emp = Employee(
            employee_id=edef["employee_id"],
            first_name=edef["first_name"],
            last_name=edef["last_name"],
            email=edef["email"],
            phone=edef["phone"],
            department=edef["department"],
            designation=edef["designation"],
            status=EmployeeStatus.active,
            joined_date=date.today(),
            role_id=role.id,
        )
        db.add(emp)
        db.flush()
        print(_green(
            f"  CREATE employee '{emp.employee_id}' -- {emp.first_name} {emp.last_name} "
            f"[role: {edef['role_name']}] -- db id={emp.id}"
        ))
        created.append({
            "role": edef["role_name"],
            "employee_id_field": emp.employee_id,
            "db_id": emp.id,
            "name": f"{emp.first_name} {emp.last_name}",
            "skipped": False,
        })

    return created


# ===========================================================================
# Main entry point
# ===========================================================================

def run_seed():
    db: Session = SessionLocal()

    print(_bold("=" * 55))
    print(_bold("  HRM Document Module - Database Seed"))
    print(_bold("=" * 55))

    try:
        perm_map = seed_permissions(db)
        role_map = seed_roles(db, perm_map)
        employees = seed_test_employees(db, role_map)

        db.commit()
        print(_green("\n[OK] All changes committed successfully.\n"))

    except Exception as exc:
        db.rollback()
        print(_red(f"\n[FAIL] Seed failed - transaction rolled back.\n  Error: {exc}"))
        sys.exit(1)
    finally:
        db.close()

    # ------------------------------------------------------------------
    # Summary table
    # ------------------------------------------------------------------
    print(_bold("=" * 55))
    print(_bold("  Test Employee IDs (use as X-Employee-ID header)"))
    print(_bold("=" * 55))
    print(f"  {'Role':<14} {'employee_id':<16} {'DB id':<8} {'Name'}")
    print(f"  {'-'*14} {'-'*16} {'-'*8} {'-'*20}")
    for e in employees:
        status_tag = _yellow("[skipped]") if e["skipped"] else _green("[created]")
        print(
            f"  {e['role']:<14} {e['employee_id_field']:<16} {e['db_id']:<8} {e['name']}  {status_tag}"
        )
    print()
    print("  NOTE: Use the integer 'DB id' as the X-Employee-ID header value.")
    print()


if __name__ == "__main__":
    run_seed()
