"""
cleanup_test_users.py
=====================
Removes the 4 QA test users and the 2 custom QA roles created by seed_test_users.py.
Also lists ALL current users in the system so you can decide what else to remove.

Run from the backend/ directory:
    python3 cleanup_test_users.py

For removing ALL non-test users too, use the --nuke flag:
    python3 cleanup_test_users.py --nuke
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.database.database import SessionLocal
from app.auth.models import User
from app.roles.models import Role

QA_EMAILS = [
    "qa.hr@test.local",
    "qa.manager@test.local",
    "qa.panel@test.local",
    "qa.viewer@test.local",
]

QA_ROLE_NAMES = [
    "QA Panel Member",
    "QA Viewer",
]


def list_all_users(db: Session):
    users = db.query(User).filter(
        (User.is_deleted == False) | (User.is_deleted == None)
    ).order_by(User.id).all()

    print(f"\n── Current users in the system ({len(users)} total) ──────────────────")
    print(f"{'ID':<5} {'Username':<20} {'Email':<35} {'Role':<20} {'Superadmin'}")
    print("-" * 100)
    for u in users:
        print(f"{u.id:<5} {(u.username or '—'):<20} {u.email:<35} {(u.role or '—'):<20} {'YES' if u.is_superadmin else 'no'}")
    print()


def remove_qa_users(db: Session):
    print("\n── Removing QA test users ───────────────────────────────────────────")
    for email in QA_EMAILS:
        user = db.query(User).filter(User.email == email).first()
        if user:
            db.delete(user)
            print(f"  [DELETED] {email}")
        else:
            print(f"  [SKIP]    Not found: {email}")
    db.commit()


def remove_qa_roles(db: Session):
    print("\n── Removing QA custom roles ─────────────────────────────────────────")
    for role_name in QA_ROLE_NAMES:
        role = db.query(Role).filter_by(role_name=role_name).first()
        if role:
            db.delete(role)
            print(f"  [DELETED] {role_name}")
        else:
            print(f"  [SKIP]    Not found: {role_name}")
    db.commit()


def nuke_all_non_superadmin(db: Session):
    """Delete EVERY user that is NOT a superadmin (use with caution)."""
    users = db.query(User).filter(
        User.is_superadmin == False,
        (User.is_deleted == False) | (User.is_deleted == None),
    ).all()
    print(f"\n── NUKE: removing {len(users)} non-superadmin users ─────────────────")
    for u in users:
        print(f"  [DELETED] {u.email}")
        db.delete(u)
    db.commit()
    print("  Done.")


def main():
    nuke = "--nuke" in sys.argv
    db: Session = SessionLocal()
    try:
        list_all_users(db)

        if nuke:
            confirm = input("⚠️  This will DELETE ALL non-superadmin users. Type YES to continue: ")
            if confirm.strip() != "YES":
                print("Aborted.")
                return
            nuke_all_non_superadmin(db)
        else:
            remove_qa_users(db)
            remove_qa_roles(db)

        print("\n✅ Done.")
        print("\nRemaining users after cleanup:")
        list_all_users(db)

    except Exception as e:
        db.rollback()
        print(f"\n❌ Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
