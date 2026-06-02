import os
import sys

# Add the parent directory to sys.path to import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database.database import SessionLocal
from app.auth.models import User, AuditLog
from app.employees.models import Employee
from app.departments.models import Department
from app.roles.models import user_roles, Role, Permission
from app.messages.models import Message, MessageRecipient
from app.notifications.models import Notification
from app.announcements.models import Announcement
from app.events.models import Event
from app.time_tracking.models import TimeEntry
from sqlalchemy import text

def cleanup_database():
    db = SessionLocal()
    try:
        print("Starting database cleanup...")

        # 1. Identify users to delete (is_superadmin is False or NULL)
        users_to_delete = db.query(User).filter(
            (User.is_superadmin == False) | (User.is_superadmin == None)
        ).all()
        user_ids = [u.id for u in users_to_delete]
        
        if not user_ids:
            print("No non-superadmin users found to delete.")
            return

        print(f"Found {len(user_ids)} users to delete.")

        # 2. Delete related records in correct order to handle constraints
        # Using raw SQL for tables where FKs might not be explicitly defined in SQLAlchemy but exist in DB
        
        # Join table (User <-> Role)
        db.execute(user_roles.delete().where(user_roles.c.user_id.in_(user_ids)))
        print("  - Cleaned user_roles")

        # Audit Logs
        db.query(AuditLog).filter(AuditLog.user_id.in_(user_ids)).delete(synchronize_session=False)
        print("  - Cleaned audit_logs")

        # Employees
        db.query(Employee).filter(Employee.user_id.in_(user_ids)).delete(synchronize_session=False)
        print("  - Cleaned employees")

        # Messages cleanup
        # 1. Delete recipients for messages sent by these users
        db.execute(text("DELETE FROM message_recipients WHERE message_id IN (SELECT id FROM messages WHERE sender_id IN :ids)"), {"ids": tuple(user_ids)})
        # 2. Delete recipient records where these users are the recipients
        db.execute(text("DELETE FROM message_recipients WHERE recipient_id IN :ids"), {"ids": tuple(user_ids)})
        # 3. Delete the messages themselves
        db.execute(text("DELETE FROM messages WHERE sender_id IN :ids"), {"ids": tuple(user_ids)})
        print("  - Cleaned messages and recipients")

        # Notifications
        db.execute(text("DELETE FROM notifications WHERE user_id IN :ids"), {"ids": tuple(user_ids)})
        print("  - Cleaned notifications")

        # Announcements (created_by)
        db.execute(text("DELETE FROM announcements WHERE created_by IN :ids"), {"ids": tuple(user_ids)})
        print("  - Cleaned announcements")

        # Events (created_by)
        db.execute(text("DELETE FROM events WHERE created_by IN :ids"), {"ids": tuple(user_ids)})
        print("  - Cleaned events")

        # Time Entries
        db.execute(text("DELETE FROM time_entries WHERE user_id IN :ids"), {"ids": tuple(user_ids)})
        print("  - Cleaned time_entries")

        # Finally, delete the users
        db.query(User).filter(User.id.in_(user_ids)).delete(synchronize_session=False)
        print(f"  - Successfully deleted {len(user_ids)} users.")

        db.commit()
        print("\nCleanup complete!")

    except Exception as e:
        db.rollback()
        print(f"\n[ERROR] Cleanup failed: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    cleanup_database()
