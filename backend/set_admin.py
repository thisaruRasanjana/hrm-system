from app.database.database import SessionLocal
from app.auth.models import User
import app.roles.models
import app.auth.models
import app.departments.models
import app.employees.models
import app.time_tracking.models
import app.messages.models
import app.announcements.models
import app.events.models
import app.notifications.models
import app.calendar_holidays.models
import app.dashboard.models

db = SessionLocal()
admin = db.query(User).filter(User.is_superadmin == True).first()
if admin:
    print(f"Super Admin: {admin.email} (is_superadmin={admin.is_superadmin})")
else:
    print("No Super Admin found with is_superadmin=True. Checking for 'admin@hrm.lk'...")
    admin = db.query(User).filter(User.email == "admin@hrm.lk").first()
    if admin:
        print(f"Found {admin.email}. Setting is_superadmin=True...")
        admin.is_superadmin = True
        db.commit()
        print("[OK] admin@hrm.lk is now Super Admin.")
    else:
        print("Admin user not found.")
db.close()
