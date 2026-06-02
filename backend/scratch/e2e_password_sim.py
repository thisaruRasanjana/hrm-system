"""
End-to-end simulation of the create_employee password flow.
This mimics exactly what service.py does and verifies each step.
"""
import sys, secrets, string
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv()

from app.database.database import SessionLocal
from app.auth.models import User
from app.employees.models import Employee  # noqa
from app.departments.models import Department  # noqa
from app.core.security import hash_password, verify_password

db = SessionLocal()

print("=" * 60)
print("STEP 1: Generate temp_password (same logic as service.py)")
temp_password = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))
print(f"  temp_password = '{temp_password}'")

print()
print("STEP 2: Hash it (same as service.py line 39)")
hashed = hash_password(temp_password)
print(f"  hashed = '{hashed}'")
print(f"  hashed length = {len(hashed)}")

print()
print("STEP 3: Verify password against hash BEFORE saving to DB")
pre_save_result = verify_password(temp_password, hashed)
print(f"  verify_password(temp_password, hashed) = {pre_save_result}")

print()
print("STEP 4: Create User object and write to DB (same as service.py)")
test_email = "simulation.test@example.com"

# Clean up any previous simulation user
existing = db.query(User).filter(User.email == test_email).first()
if existing:
    db.delete(existing)
    db.commit()
    print(f"  Removed existing simulation user.")

db_user = User(
    username=test_email,
    email=test_email,
    password_hash=hashed,
    is_active=True,
    first_name="Sim",
    last_name="Test",
)
db.add(db_user)
db.commit()
db.refresh(db_user)
print(f"  User saved. DB id={db_user.id}, email={db_user.email}")

print()
print("STEP 5: Re-read user from DB and verify password")
fresh_user = db.query(User).filter(User.email == test_email).first()
print(f"  hash from DB: {fresh_user.password_hash}")
print(f"  hash length:  {len(fresh_user.password_hash)}")
post_save_result = verify_password(temp_password, fresh_user.password_hash)
print(f"  verify_password(temp_password, hash_from_DB) = {post_save_result}")

print()
print("=" * 60)
if pre_save_result and post_save_result:
    print("ALL STEPS PASSED — The creation flow is correct.")
    print(f"  Email would contain: '{temp_password}'")
    print(f"  DB has hash of:      '{temp_password}'")
    print(f"  These match: True")
elif pre_save_result and not post_save_result:
    print("FAIL: Hash is correct before DB save but WRONG after re-read.")
    print("This means DB is corrupting/modifying the hash on write.")
elif not pre_save_result:
    print("FAIL: hash_password and verify_password are inconsistent.")

# Cleanup
db.delete(fresh_user)
db.commit()
print()
print("Simulation user cleaned up.")
db.close()
