from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import jwt, JWTError
import random
import time

from app.database.session import get_db
from app.auth.schemas import LoginRequest, TokenResponse
from app.auth.service import authenticate_user
from app.auth.models import User
from app.core.email import send_otp_email
from app.core.jwt import SECRET_KEY, ALGORITHM
from app.core.security import hash_password

router = APIRouter()
security = HTTPBearer()

otp_storage = {}


# ---------------- LOGIN ----------------

@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    token = authenticate_user(db, data.email, data.password)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    return token


# ---------------- SEND OTP ----------------

@router.post("/send-otp")
def send_otp(data: dict):
    email = data.get("email")

    if not email:
        raise HTTPException(status_code=400, detail="Email required")

    email = email.strip().lower()

    otp = str(random.randint(100000, 999999))

    otp_storage[email] = {
        "otp": otp,
        "expires": time.time() + 300
    }

    send_otp_email(email, otp)

    return {"message": "OTP sent successfully"}


# ---------------- VERIFY OTP ----------------

@router.post("/verify-otp")
def verify_otp(data: dict):
    email = data.get("email")
    otp = data.get("otp")

    if not email or not otp:
        raise HTTPException(status_code=400, detail="Email and OTP required")

    email = email.strip().lower()

    record = otp_storage.get(email)

    if not record:
        raise HTTPException(status_code=400, detail="No OTP found")

    if time.time() > record["expires"]:
        otp_storage.pop(email)
        raise HTTPException(status_code=400, detail="OTP expired")

    if record["otp"] != otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    otp_storage.pop(email)

    return {"message": "OTP verified successfully"}


# ---------------- RESET PASSWORD ----------------

@router.post("/reset-password")
def reset_password(data: dict, db: Session = Depends(get_db)):
    email = data.get("email")
    new_password = data.get("password")

    if not email or not new_password:
        raise HTTPException(status_code=400, detail="Email and password required")

    email = email.strip().lower()

    user = db.query(User).filter(User.email.ilike(email)).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = hash_password(new_password)

    db.commit()

    return {"message": "Password updated successfully"}


# ---------------- CURRENT USER ----------------

@router.get("/me")
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == int(user_id)).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": user.id,
        "email": user.email,
        "is_active": user.is_active
    }