"""
Resets the most recently created non-superadmin user's password
to a known value and prints login credentials.
"""
import sys
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv()

from app.database.database import SessionLocal
from app.auth.models import User
from app.employees.models import Employee  # noqa
from app.departments.models import Department  # noqa
from app.core.security import hash_password, verify_password

KNOWN_PASSWORD = "NewEmployee@1"

db = SessionLocal()
user = db.query(User).filter(
    User.is_superadmin == False,
    (User.is_deleted == False) | (User.is_deleted == None)
).order_by(User.id.desc()).first()

if not user:
    print("No non-superadmin active user found.")
    db.close()
    sys.exit(1)

print(f"Found user: {user.email} (id={user.id})")
print(f"Old hash: {user.password_hash[:30]}...")

user.password_hash = hash_password(KNOWN_PASSWORD)
db.commit()
db.refresh(user)

verified = verify_password(KNOWN_PASSWORD, user.password_hash)
print(f"New hash set. verify_password = {verified}")
print()
print("=" * 50)
print("LOGIN CREDENTIALS:")
print(f"  Email:    {user.email}")
print(f"  Password: {KNOWN_PASSWORD}")
print("=" * 50)
db.close()
