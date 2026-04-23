"""
auth/service.py — Authentication logic only.
Role/Permission management has moved to roles/service.py.
"""
from typing import Optional, List
from sqlalchemy.orm import Session
from app.auth.models import User
from app.core.security import verify_password, create_access_token


# ── User lookup helpers ───────────────────────────────────────────────────────

def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email.ilike(email)).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


# ── Authentication ────────────────────────────────────────────────────────────

def authenticate_user(db: Session, identifier: str, password: str) -> Optional[dict]:
    """
    Authenticate via email OR username.
    Returns a token dict on success, None on failure.
    """
    # Try email first, then username
    user = get_user_by_email(db, identifier)
    if not user:
        user = get_user_by_username(db, identifier)

    if not user:
        return None

    if not verify_password(password, user.password_hash):
        return None

    from app.core.security import create_access_token
    from datetime import timedelta

    access_token = create_access_token({"sub": str(user.id)})

    # Create refresh token (longer-lived)
    refresh_token = create_access_token(
        {"sub": str(user.id), "type": "refresh"},
        expires_delta=timedelta(days=7)
    )

    # Persist refresh token
    user.refresh_token = refresh_token
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


# ── Permissions ───────────────────────────────────────────────────────────────

def get_user_permissions(db: Session, user_id: int) -> List[str]:
    """Return a flat list of permission_name strings for a user (across all roles)."""
    user = get_user_by_id(db, user_id)
    if not user:
        return []
    perms: set[str] = set()
    for role in user.roles:
        for perm in role.permissions:
            perms.add(perm.permission_name)
    return list(perms)
