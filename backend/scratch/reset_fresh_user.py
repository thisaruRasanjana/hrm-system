import sys
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv()
from app.database.database import SessionLocal
from app.auth.models import User
from app.employees.models import Employee  # noqa
from app.departments.models import Department  # noqa
from app.core.security import hash_password, verify_password

NEW_PASSWORD = "FreshTest@123"
EMAIL = "fresh.test@example.com"

db = SessionLocal()
user = db.query(User).filter(User.email == EMAIL).first()
if not user:
    print(f"ERROR: User {EMAIL} not found.")
    db.close()
    sys.exit(1)

print(f"Found user: {user.email}")
print(f"Old hash: {user.password_hash}")

# Reset to known password
new_hash = hash_password(NEW_PASSWORD)
user.password_hash = new_hash
db.commit()
db.refresh(user)

print(f"New hash: {user.password_hash}")
print(f"New hash length: {len(user.password_hash)}")

# Immediately verify
result = verify_password(NEW_PASSWORD, user.password_hash)
print(f"verify_password('{NEW_PASSWORD}', new_hash) = {result}")

if result:
    print()
    print("SUCCESS: Password reset and verified.")
    print(f"You can now login as: {EMAIL} / {NEW_PASSWORD}")
else:
    print("FAIL: Something is still wrong with verify_password.")

db.close()
