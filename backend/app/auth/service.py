from sqlalchemy.orm import Session
from app.auth.models import User
from app.core.security import verify_password
from app.core.jwt import create_access_token, create_refresh_token


def authenticate_user(db: Session, identifier: str, password: str):
    """
    Authenticate via email OR username.
    'identifier' can be either the email address or the username.
    """
    # Try email first, then username
    user = db.query(User).filter(User.email.ilike(identifier)).first()
    if not user:
        user = db.query(User).filter(User.username == identifier).first()

    if not user:
        return None

    if not verify_password(password, user.hashed_password):
        return None

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    # Store refresh token in DB
    user.refresh_token = refresh_token
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }