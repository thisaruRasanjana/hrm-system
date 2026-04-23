"""
auth/service.py — Authentication logic only.
Role/Permission management has moved to roles/service.py.
"""
from typing import Optional, List
from sqlalchemy.orm import Session
from app.auth.models import User


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    user = get_user_by_username(db, username)
    if not user:
        return None
    
    from app.auth.utils import verify_password
    if not verify_password(password, user.hashed_password):
        return None
    
    return user


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
