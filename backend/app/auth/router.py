from fastapi import APIRouter, Depends, HTTPException, status, Response, Request, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import jwt, JWTError
import random
import time

from app.database.session import get_db
from app.auth.schemas import (
    LoginRequest, TokenResponse, UserResponse, 
    UserProfileUpdate, UserPasswordUpdate, UserNotificationUpdate
)
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

@router.post("/login")
def login(data: LoginRequest, response: Response, db: Session = Depends(get_db)):

    user = db.query(User).filter(User.email.ilike(data.email)).first()
    token = authenticate_user(db, data.email, data.password)

    if not token or not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
        
    if user.two_factor_enabled:
        temp_token = create_access_token({"sub": str(user.id), "type": "2fa"})
        return {"require_2fa": True, "temp_token": temp_token}

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

@router.post("/login/2fa")
def login_2fa(data: dict, response: Response, db: Session = Depends(get_db)):
    temp_token = data.get("temp_token")
    code = data.get("code")

    try:
        payload = jwt.decode(temp_token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "2fa":
            raise HTTPException(401, "Invalid token type")
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(401, "Invalid temporary token")
        
    user = db.query(User).filter(User.id == int(user_id)).first()
    import pyotp
    if not user or not user.totp_secret:
        raise HTTPException(400, "2FA not configured")
    
    if not pyotp.TOTP(user.totp_secret).verify(code):
        raise HTTPException(400, "Invalid 2FA code")
    
    from app.core.jwt import create_refresh_token
    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    
    response.set_cookie(
        key="refresh_token", value=refresh_token, httponly=True, secure=False,
        samesite="lax", max_age=60 * 60 * 24 * 7, path="/"
    )
    return {"access_token": access_token, "token_type": "bearer"}


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

@router.get("/me", response_model=UserResponse)
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):

    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") == "2fa":
            raise HTTPException(status_code=401, detail="Temporary 2FA token cannot access this endpoint")
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user

# ---------------- SETTINGS & PROFILE ----------------

@router.put("/profile", response_model=UserResponse)
def update_profile(
    data: UserProfileUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") == "2fa": raise HTTPException(status_code=401, detail="Unauthorized token")
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update profile fields
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)
    
    db.commit()
    db.refresh(user)
    return user

@router.post("/profile/image")
def upload_profile_image(
    file: UploadFile = File(...),
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") == "2fa": raise HTTPException(status_code=401, detail="Unauthorized token")
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    import os
    import shutil
    from pathlib import Path
    
    upload_dir = Path("uploads/profiles")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    file_path = upload_dir / f"{user.id}.{ext}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    user.profile_image_url = f"http://127.0.0.1:8000/uploads/profiles/{user.id}.{ext}"
    db.commit()
    db.refresh(user)
    return {"profile_image_url": user.profile_image_url}

@router.put("/security/password")
def change_password(
    data: UserPasswordUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") == "2fa": raise HTTPException(status_code=401, detail="Unauthorized token")
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    from app.core.security import verify_password
    if not verify_password(data.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect current password")

    user.hashed_password = hash_password(data.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


@router.get("/security/2fa/setup")
def setup_two_factor(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") == "2fa": raise HTTPException(status_code=401, detail="Unauthorized token")
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    import pyotp
    import urllib.parse
    
    if not user.totp_secret:
        user.totp_secret = pyotp.random_base32()
        db.commit()

    uri = pyotp.totp.TOTP(user.totp_secret).provisioning_uri(name=user.email, issuer_name="HRMS")
    encoded_uri = urllib.parse.quote(uri)
    
    return {
        "secret": user.totp_secret, 
        "qr_code_url": f"https://api.qrserver.com/v1/create-qr-code/?size=200x200&data={encoded_uri}"
    }

@router.post("/security/2fa/verify", response_model=UserResponse)
def verify_and_enable_two_factor(
    data: dict,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") == "2fa": raise HTTPException(status_code=401, detail="Unauthorized token")
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    code = data.get("code")
    import pyotp
    if not user.totp_secret or not pyotp.TOTP(user.totp_secret).verify(code):
        raise HTTPException(status_code=400, detail="Invalid verification code")

    user.two_factor_enabled = True
    db.commit()
    db.refresh(user)
    return user

@router.delete("/security/2fa", response_model=UserResponse)
def disable_two_factor(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") == "2fa": raise HTTPException(status_code=401, detail="Unauthorized token")
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.two_factor_enabled = False
    # we don't clear totp_secret so they can reuse the app, but they'd have to re-verify to enable it again.
    # Actually, it's safer to clear it.
    user.totp_secret = None
    db.commit()
    db.refresh(user)
    return user



@router.put("/notifications", response_model=UserResponse)
def update_notifications(
    data: UserNotificationUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") == "2fa": raise HTTPException(status_code=401, detail="Unauthorized token")
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.notification_preferences = data.notification_preferences
    user.quiet_hours_start = data.quiet_hours_start
    user.quiet_hours_end = data.quiet_hours_end
    
    db.commit()
    db.refresh(user)
    return user