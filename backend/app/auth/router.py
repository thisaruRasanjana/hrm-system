import os
import random
import time
import qrcode
import base64
from io import BytesIO
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request, UploadFile, File
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from app.database.database import get_db
from app.auth.schemas import (
    LoginRequest, TokenResponse, UserResponse,
    UserProfileUpdate, UserPasswordUpdate, UserNotificationUpdate
)
from app.core.security import SECRET_KEY, ALGORITHM, create_access_token, hash_password, verify_password
from app.core.deps import get_current_user, get_user_permissions
from app.auth.service import authenticate_user, get_user_by_email
from app.auth.models import User, AuditLog, OTPRecord
from app.core.email import send_otp_email

router = APIRouter()
security = HTTPBearer()

# ── Environment Configuration ────────────────────────────────────────────────
OTP_EXPIRE_SECONDS = int(os.getenv("OTP_EXPIRE_SECONDS", "300"))

# ---------------- LOGIN ----------------

@router.post("/login")
def login(data: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "Unknown"

    identifier = data.email or data.username
    if not identifier:
        raise HTTPException(status_code=400, detail="Email or username required")

    token = authenticate_user(db, identifier, data.password)
    if not token:
        audit_log = AuditLog(action="LOGIN_FAILED", ip_address=client_ip)
        db.add(audit_log)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    user = (
        db.query(User).filter(User.email.ilike(identifier)).first()
        or db.query(User).filter(User.username == identifier).first()
    )

    if user and user.two_factor_enabled:
        temp_token = create_access_token({"sub": str(user.id), "type": "2fa"})
        return {"require_2fa": True, "temp_token": temp_token}

    refresh_token = token["refresh_token"]

    from app.core.jwt import REFRESH_TOKEN_EXPIRE_DAYS
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="none",
        max_age=60 * 60 * 24 * REFRESH_TOKEN_EXPIRE_DAYS,
        path="/"
    )

    if user:
        audit_log = AuditLog(user_id=user.id, action="LOGIN_SUCCESS", ip_address=client_ip)
        db.add(audit_log)
        db.commit()

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

    from app.core.jwt import REFRESH_TOKEN_EXPIRE_DAYS
    access_token = create_access_token({"sub": str(user.id)})
    from app.core.jwt import create_refresh_token
    refresh_token = create_refresh_token({"sub": str(user.id)})

    response.set_cookie(
        key="refresh_token", value=refresh_token, httponly=True, secure=False,
        samesite="none", max_age=60 * 60 * 24 * REFRESH_TOKEN_EXPIRE_DAYS, path="/"
    )
    return {"access_token": access_token, "token_type": "bearer"}


# ---------------- REFRESH TOKEN ----------------

@router.post("/refresh")
def refresh_token(request: Request, response: Response, db: Session = Depends(get_db)):
    refresh_token = request.cookies.get("refresh_token")

    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")

    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        user = db.query(User).filter(User.id == int(user_id)).first()
        
        if not user or user.refresh_token != refresh_token:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
            
        from app.core.jwt import create_refresh_token, REFRESH_TOKEN_EXPIRE_DAYS
        new_access = create_access_token({"sub": str(user_id)})
        new_refresh = create_refresh_token({"sub": str(user_id)})
        
        user.refresh_token = new_refresh
        db.commit()

        response.set_cookie(
            key="refresh_token", value=new_refresh, httponly=True, secure=False,
            samesite="none", max_age=60 * 60 * 24 * REFRESH_TOKEN_EXPIRE_DAYS, path="/"
        )
        return {"access_token": new_access, "token_type": "bearer"}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


# ---------------- LOGOUT ----------------

@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    refresh_token = request.cookies.get("refresh_token")
    client_ip = request.client.host if request.client else "Unknown"
    
    if refresh_token:
        try:
            payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
            user = db.query(User).filter(User.id == int(user_id)).first()
            if user:
                user.refresh_token = None
                audit_log = AuditLog(user_id=user.id, action="LOGOUT", ip_address=client_ip)
                db.add(audit_log)
                db.commit()
        except JWTError:
            pass
            
    response.delete_cookie(key="refresh_token", path="/", httponly=True, secure=False, samesite="none")
    return {"message": "Logged out successfully"}


# ---------------- SEND OTP ----------------

@router.post("/send-otp")
def send_otp(data: dict, db: Session = Depends(get_db)):
    email = data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email required")

    email = email.strip().lower()
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Generate OTP
    otp = str(random.randint(100000, 999999))
    expires_at = datetime.utcnow() + timedelta(seconds=OTP_EXPIRE_SECONDS)

    # Save to DB (cleanup old ones for this email first)
    db.query(OTPRecord).filter(OTPRecord.email == email).delete()
    otp_record = OTPRecord(email=email, otp=otp, expires_at=expires_at)
    db.add(otp_record)
    db.commit()

    send_otp_email(email, otp)
    return {"message": "OTP sent successfully"}


# ---------------- VERIFY OTP ----------------

@router.post("/verify-otp")
def verify_otp(data: dict, db: Session = Depends(get_db)):
    email = data.get("email")
    otp = data.get("otp")
    if not email or not otp:
        raise HTTPException(status_code=400, detail="Email and OTP required")

    email = email.strip().lower()
    record = db.query(OTPRecord).filter(OTPRecord.email == email, OTPRecord.otp == otp).first()
    
    if not record:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    if datetime.utcnow() > record.expires_at:
        db.delete(record)
        db.commit()
        raise HTTPException(status_code=400, detail="OTP expired")

    record.verified = True
    db.commit()
    return {"message": "OTP verified successfully"}


# ---------------- RESET PASSWORD ----------------

@router.post("/reset-password")
def reset_password(data: dict, db: Session = Depends(get_db)):
    email = data.get("email")
    new_password = data.get("password")
    if not email or not new_password:
        raise HTTPException(status_code=400, detail="Email and password required")

    email = email.strip().lower()
    record = db.query(OTPRecord).filter(OTPRecord.email == email, OTPRecord.verified == True).first()
    
    if not record:
        raise HTTPException(status_code=403, detail="OTP verification required")
    
    if datetime.utcnow() > record.expires_at:
        db.delete(record)
        db.commit()
        raise HTTPException(status_code=400, detail="OTP expired")

    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = hash_password(new_password)
    db.delete(record) # Delete after use
    db.commit()
    return {"message": "Password updated successfully"}


# ---------------- CURRENT USER ----------------

@router.get("/me", response_model=UserResponse)
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    permissions = get_user_permissions(current_user, db)

    user_dict = {
        c.name: getattr(current_user, c.name, None)
        for c in current_user.__table__.columns
        if c.name not in ("hashed_password", "password_hash", "refresh_token", "totp_secret")
    }
    user_dict["permissions"] = permissions

    if current_user.employee:
        emp = current_user.employee
        user_dict.update({
            "designation": emp.designation,
            "joined_date": str(emp.joined_date) if emp.joined_date else None,
            "status": emp.status.value if emp.status else None,
            "gender": emp.gender,
            "marital_status": emp.marital_status,
            "nationality": emp.nationality,
            "emergency_contact_name": emp.emergency_contact_name,
            "emergency_contact_relation": emp.emergency_contact_relation,
            "bank_name": emp.bank_name,
            "bank_account_no": emp.bank_account_no,
            "bank_branch": emp.bank_branch,
            "skills": emp.skills,
            "qualifications": emp.qualifications,
        })

    return user_dict


# ---------------- SETTINGS & PROFILE ----------------

@router.put("/profile", response_model=UserResponse)
def update_profile(
    data: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = current_user
    update_data = data.model_dump(exclude_unset=True)
    
    # Sanitize all possible date fields to prevent "invalid input syntax for type date: ''"
    date_fields = ["date_of_birth", "joined_date"]
    for field in date_fields:
        if field in update_data and update_data[field] == "":
            update_data[field] = None
            
    user_fields = ["first_name", "last_name", "phone_number", "address", "date_of_birth", "emergency_contact_number"]

    for key in user_fields:
        if key in update_data:
            setattr(user, key, update_data[key])

    if user.employee:
        emp_keys = ["gender", "marital_status", "nationality", "emergency_contact_name", "emergency_contact_relation", "bank_name", "bank_account_no", "bank_branch", "skills", "qualifications"]
        for key in emp_keys:
            if key in update_data:
                setattr(user.employee, key, update_data[key])
        
        # Sync User details to Employee model
        if "first_name" in update_data: user.employee.first_name = update_data["first_name"]
        if "last_name" in update_data: user.employee.last_name = update_data["last_name"]
        if "phone_number" in update_data: user.employee.phone = update_data["phone_number"]
        if "address" in update_data: user.employee.address = update_data["address"]
        if "date_of_birth" in update_data: user.employee.date_of_birth = update_data["date_of_birth"]
        if "emergency_contact_number" in update_data: user.employee.emergency_contact_phone = update_data["emergency_contact_number"]

    db.commit()
    db.refresh(user)
    return user


@router.post("/profile/image")
def upload_profile_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import shutil
    from pathlib import Path

    upload_dir = Path("uploads/profiles")
    upload_dir.mkdir(parents=True, exist_ok=True)

    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    file_path = upload_dir / f"{current_user.id}.{ext}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    current_user.profile_image_url = f"http://127.0.0.1:8000/uploads/profiles/{current_user.id}.{ext}"
    db.commit()
    db.refresh(current_user)
    return {"profile_image_url": current_user.profile_image_url}


@router.put("/security/password")
def change_password(
    data: UserPasswordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect current password")
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    current_user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


@router.get("/security/2fa/setup")
def setup_two_factor(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import pyotp
    import urllib.parse

    if not current_user.totp_secret:
        current_user.totp_secret = pyotp.random_base32()
        db.commit()

    uri = pyotp.totp.TOTP(current_user.totp_secret).provisioning_uri(name=current_user.email, issuer_name="HRMS")
    
    # Generate local QR code
    qr = qrcode.make(uri)
    buffer = BytesIO()
    qr.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()

    return {
        "secret": current_user.totp_secret,
        "qr_code_url": f"data:image/png;base64,{qr_base64}"
    }


@router.post("/security/2fa/verify", response_model=UserResponse)
def verify_and_enable_two_factor(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    code = data.get("code")
    import pyotp
    if not current_user.totp_secret or not pyotp.TOTP(current_user.totp_secret).verify(code):
        raise HTTPException(status_code=400, detail="Invalid verification code")

    current_user.two_factor_enabled = True
    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/security/2fa", response_model=UserResponse)
def disable_two_factor(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.two_factor_enabled = False
    current_user.totp_secret = None
    db.commit()
    db.refresh(current_user)
    return current_user


@router.put("/notifications", response_model=UserResponse)
def update_notifications(
    data: UserNotificationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.notification_preferences = data.notification_preferences
    current_user.quiet_hours_start = data.quiet_hours_start
    current_user.quiet_hours_end = data.quiet_hours_end

    db.commit()
    db.refresh(current_user)
    return current_user
