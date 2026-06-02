import sys
import os

from app.database.database import SessionLocal
from app.auth.models import User, OTPRecord
from app.employees.models import Employee  # To fix mapper error
from app.core.security import hash_password, verify_password
from app.auth.service import authenticate_user
from datetime import datetime, timedelta
import random

db = SessionLocal()

# Setup test user (User 1)
test_email = "prageethperera045@gmail.com" # Admin email from seed

otp = "123456"
db.query(OTPRecord).filter(OTPRecord.email == test_email).delete()
record = OTPRecord(email=test_email, otp=otp, expires_at=datetime.utcnow() + timedelta(minutes=5), verified=True)
db.add(record)
db.commit()

# Emulate reset_password endpoint
new_pwd = "MyNewPassword123!"
record = db.query(OTPRecord).filter(OTPRecord.email == test_email, OTPRecord.verified == True).first()
if record:
    user = db.query(User).filter(User.email.ilike(test_email)).first()
    print("Before hash:", user.password_hash)
    user.password_hash = hash_password(new_pwd)
    db.delete(record)
    db.commit()
    print("After hash:", user.password_hash)

# Emulate login
token = authenticate_user(db, test_email, new_pwd)
if token:
    print("Login successful! Token:", token["access_token"])
else:
    print("Login failed! Invalid credentials")

db.close()

