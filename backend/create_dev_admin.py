import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database.database import SessionLocal
from app.auth.models import User
from app.core.security import hash_password
from app.roles.models import Role

db = SessionLocal()

# Find super admin role
super_admin_role = db.query(Role).filter(Role.role_name == "Super Admin").first()

if not super_admin_role:
    print("Error: Super Admin role not found. Ensure DB is migrated and seeded.")
    sys.exit(1)

# Check for existing developer admin
admin_email = "dev.admin@test.local"
user = db.query(User).filter(User.email == admin_email).first()

if not user:
    user = User(
        email=admin_email,
        username="dev_admin",
        first_name="Dev",
        last_name="Admin",
        is_active=True,
        is_superadmin=True,
        role_id=super_admin_role.id
    )
    db.add(user)

# Always reset password to ensure we know it
user.password_hash = hash_password("DevAdmin@123")
user.is_superadmin = True

db.commit()
print(f"✅ Developer Super Admin account ready.")
print(f"Email: {admin_email}")
print(f"Password: DevAdmin@123")
