from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
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
from app.core.jwt import SECRET_KEY, ALGORITHM, create_access_token
from app.core.security import hash_password

router = APIRouter()
security = HTTPBearer()

# Temporary OTP storage
otp_storage = {}


# ---------------- LOGIN ----------------

@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, response: Response, db: Session = Depends(get_db)):

    token = authenticate_user(db, data.email, data.password)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    refresh_token = token["refresh_token"]

    # Store refresh token as HttpOnly cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,   # change to True in production (HTTPS)
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
        path="/"
    )

    return {
        "access_token": token["access_token"],
        "token_type": "bearer"
    }


# ---------------- REFRESH TOKEN ----------------

@router.post("/refresh")
def refresh_token(request: Request):

    refresh_token = request.cookies.get("refresh_token")

    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")

    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")

        new_access = create_access_token({"sub": user_id})

        return {
            "access_token": new_access,
            "token_type": "bearer"
        }

    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


# ---------------- SEND OTP ----------------

@router.post("/send-otp")
def send_otp(data: dict, db: Session = Depends(get_db)):

    email = data.get("email")

    if not email:
        raise HTTPException(status_code=400, detail="Email required")

    email = email.strip().lower()

    # Check if user exists
    user = db.query(User).filter(User.email.ilike(email)).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    otp = str(random.randint(100000, 999999))

    otp_storage[email] = {
        "otp": otp,
        "expires": time.time() + 120,
        "verified": False
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
        raise HTTPException(status_code=400, detail="No OTP request found")

    if time.time() > record["expires"]:
        otp_storage.pop(email)
        raise HTTPException(status_code=400, detail="OTP expired")

    if record["otp"] != otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    record["verified"] = True

    return {"message": "OTP verified successfully"}


# ---------------- RESET PASSWORD ----------------

@router.post("/reset-password")
def reset_password(data: dict, db: Session = Depends(get_db)):

    email = data.get("email")
    new_password = data.get("password")

    if not email or not new_password:
        raise HTTPException(status_code=400, detail="Email and password required")

    email = email.strip().lower()

    record = otp_storage.get(email)

    if not record:
        raise HTTPException(status_code=400, detail="No OTP request found")

    if time.time() > record["expires"]:
        otp_storage.pop(email)
        raise HTTPException(status_code=400, detail="OTP expired")

    if not record.get("verified"):
        raise HTTPException(status_code=403, detail="OTP verification required")

    user = db.query(User).filter(User.email.ilike(email)).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = hash_password(new_password)

    db.commit()

    otp_storage.pop(email)

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