# Two-Factor Authentication (2FA) Code Reference

This document contains the primary code snippets responsible for the 2FA functionality in this system.

## 1. Backend: User Model
**File:** `backend/app/auth/models.py`

The database fields that store 2FA state:
```python
class User(Base):
    # ... other fields ...
    two_factor_enabled = Column(Boolean, default=False)
    totp_secret = Column(String, nullable=True) # Base32 shared secret
```

## 2. Backend: Login Flow (Stage 1)
**File:** `backend/app/auth/router.py`

When a user submits their password, the server checks if 2FA is required:
```python
@router.post("/login")
def login(data: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    # ... authentication logic ...
    
    if user and user.two_factor_enabled:
        # Return a temporary token instead of the full access token
        temp_token = create_access_token({"sub": str(user.id), "type": "2fa"})
        return {"require_2fa": True, "temp_token": temp_token}

    # ... normal login continues ...
```

## 3. Backend: 2FA Verification (Stage 2)
**File:** `backend/app/auth/router.py`

Verifying the 6-digit code to complete the login:
```python
@router.post("/login/2fa")
def login_2fa(data: dict, response: Response, db: Session = Depends(get_db)):
    temp_token = data.get("temp_token")
    code = data.get("code")

    # 1. Decode temporary token
    payload = jwt.decode(temp_token, SECRET_KEY, algorithms=[ALGORITHM])
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()

    # 2. Verify OTP code using pyotp
    import pyotp
    if not pyotp.TOTP(user.totp_secret).verify(code):
        raise HTTPException(400, "Invalid 2FA code")

    # 3. Success - Return full access token
    access_token = create_access_token({"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}
```

## 4. Backend: Setup & Enable 2FA
**File:** `backend/app/auth/router.py`

Generating the secret and QR code:
```python
@router.get("/security/2fa/setup")
def setup_two_factor(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    import pyotp
    import qrcode
    
    # Generate Base32 secret
    if not current_user.totp_secret:
        current_user.totp_secret = pyotp.random_base32()
        db.commit()

    # Create QR code
    uri = pyotp.totp.TOTP(current_user.totp_secret).provisioning_uri(name=current_user.email, issuer_name="HRMS")
    qr = qrcode.make(uri)
    # ... return as Base64 image ...
```

## 5. Frontend: Login Page Handling
**File:** `frontend/app/login/page.tsx`

The React logic that manages the transition between password and OTP:
```typescript
const handleLogin = async (e: any) => {
  const res = await apiFetch("/auth/login", { body: JSON.stringify({ email, password }) });
  const data = await res.json();

  if (res.ok && data.require_2fa) {
    // Switch UI to OTP input mode
    setTempToken(data.temp_token);
    setShow2FA(true); 
    return;
  }
  // ...
};

const handle2FASubmit = async (e: any) => {
  const res = await apiFetch("/auth/login/2fa", {
    body: JSON.stringify({ temp_token: tempToken, code: otpCode }),
  });
  // ... login successful ...
};
```
