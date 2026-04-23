from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from typing import List

from app.database.session import get_db
from app.auth.models import User
from app.core.jwt import SECRET_KEY, ALGORITHM

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """
    Shared dependency: decodes JWT, returns the authenticated User object.
    Raises 401 if token is invalid or user not found.
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_user_permissions(user: User, db: Session) -> List[str]:
    """Resolves permissions from the user's role_id → Role.permissions list."""
    if not user.role_id:
        return []
    from app.roles.models import Role
    role = db.query(Role).filter(Role.id == user.role_id).first()
    return role.permissions if role else []


def require_permission(permission: str):
    """
    Dependency factory that checks a single permission.
    Usage:  Depends(require_permission("messaging.send"))
    """
    def _check(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        perms = get_user_permissions(current_user, db)
        if permission not in perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission required: {permission}"
            )
        return current_user
    return _check
