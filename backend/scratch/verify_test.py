import sys
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv()
from app.core.security import verify_password, hash_password
from app.database.database import SessionLocal
from app.auth.models import User
from app.employees.models import Employee  # noqa
from app.departments.models import Department  # noqa

password = "AbCd1234XyZw"
db_hash = "$2b$12$sD.SzhLMtGxDEBEZx8vixe.7LBBkorjvpFDjwva1EQUf2HYlwqShq"

print("=" * 60)
print("TEST 1: Does verify_password work standalone?")
result = verify_password(password, db_hash)
print(f"  verify_password('{password}', db_hash) = {result}")

print()
print("TEST 2: Self-hash-and-verify roundtrip")
fresh_hash = hash_password(password)
roundtrip = verify_password(password, fresh_hash)
print(f"  hash then verify same password = {roundtrip}")

print()
print("TEST 3: Read hash directly from database and verify")
db = SessionLocal()
user = db.query(User).filter(User.email == 'fresh.test@example.com').first()
if user:
    print(f"  email:           {user.email}")
    print(f"  hash in db:      {user.password_hash}")
    print(f"  hash length:     {len(user.password_hash)}")
    print(f"  is_active:       {user.is_active}")
    print(f"  is_deleted:      {user.is_deleted}")
    live_result = verify_password(password, user.password_hash)
    print(f"  verify_password against LIVE db hash = {live_result}")
else:
    print("  USER NOT FOUND in database")
db.close()
