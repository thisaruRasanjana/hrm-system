from sqlalchemy.orm import Session

from app.auth.models import User
from app.core.security import verify_password
from app.core.jwt import create_access_token, create_refresh_token


def authenticate_user(db: Session, email: str, password: str):
    """
    Authenticate user credentials and return JWT tokens
    """
    user = db.query(User).filter(User.email == email).first()

    if not user:
        return None

    if not verify_password(password, user.hashed_password):
        return None

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }
  