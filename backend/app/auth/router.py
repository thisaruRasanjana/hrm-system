from app.core.email import send_otp_email
import random
import random
from app.core.email import send_otp_email
otp_storage = {}


from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.auth.schemas import LoginRequest, TokenResponse
from app.auth.service import authenticate_user

router = APIRouter()

@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    token = authenticate_user(db, data.email, data.password)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    return token

@router.post("/send-otp")
def send_otp(data: dict):
    email = data.get("email")

    if not email:
        raise HTTPException(status_code=400, detail="Email required")

    otp = str(random.randint(100000, 999999))
    otp_storage[email] = otp

    send_otp_email(email, otp)

    return {"message": "OTP sent successfully"}

@router.post("/verify-otp")
def verify_otp(data: dict):
    email = data.get("email")
    otp = data.get("otp")

    if not email or not otp:
        raise HTTPException(status_code=400, detail="Email and OTP required")

    stored_otp = otp_storage.get(email)

    if not stored_otp:
        raise HTTPException(status_code=400, detail="No OTP found. Please request again.")

    if stored_otp != otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    # Optional: remove OTP after successful verification
    otp_storage.pop(email)

    return {"message": "OTP verified successfully"}
