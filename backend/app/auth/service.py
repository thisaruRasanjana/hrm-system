"""
auth/service.py — Authentication logic only.
Role/Permission management has moved to roles/service.py.
"""
from typing import Optional, List
from datetime import timedelta
from sqlalchemy.orm import Session
from app.auth.models import User
from app.core.security import verify_password
from app.core.jwt import create_access_token, create_refresh_token

# ── User lookup helpers ───────────────────────────────────────────────────────

def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(
        User.username == username,
        (User.is_deleted == False) | (User.is_deleted == None)
    ).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(
        User.email.ilike(email),
        (User.is_deleted == False) | (User.is_deleted == None)
    ).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(
        User.id == user_id,
        (User.is_deleted == False) | (User.is_deleted == None)
    ).first()


# ── Authentication ────────────────────────────────────────────────────────────

def authenticate_user(db: Session, identifier: str, password: str) -> Optional[dict]:
    """
    Authenticate via email OR username (case-insensitive).
    Returns a token dict on success, None on failure.
    """
    identifier = identifier.strip()
    user = db.query(User).filter(
        ((User.email.ilike(identifier)) | (User.username.ilike(identifier))),
        ((User.is_deleted == False) | (User.is_deleted == None))
    ).first()

    if not user:
        return None

    if not verify_password(password, user.password_hash):
        return None

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})

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
        
    # Super Admin Bypass
    if getattr(user, "is_superadmin", False):
        from app.roles.models import Permission
        all_perms = db.query(Permission).all()
        return [p.permission_name for p in all_perms]
        
    perms: set[str] = set()
    for role in user.roles:
        for perm in role.permissions:
            perms.add(perm.permission_name)
    return list(perms)
