from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from typing import List

from app.database.database import get_db
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
        
        # Block temporary 2FA tokens from accessing regular endpoints
        if payload.get("type") == "2fa":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Temporary 2FA token cannot access this endpoint"
            )
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_user_permissions(user: User, db: Session) -> List[str]:
    """
    Resolves permissions from the user's roles.
    Super Admins (is_superadmin=True) automatically get ALL permissions.
    """
    # Super Admin Bypass
    if getattr(user, "is_superadmin", False):
        from app.roles.models import Permission
        all_perms = db.query(Permission).all()
        return [p.permission_name for p in all_perms]

    permissions = set()
    
    # 1. From many-to-many roles
    if user.roles:
        for role in user.roles:
            for perm in role.permissions:
                permissions.add(perm.permission_name)
    
    # 2. Fallback to single role_id if many-to-many is empty
    elif user.role_id:
        from app.roles.models import Role
        role = db.query(Role).filter(Role.id == user.role_id).first()
        if role:
            for perm in role.permissions:
                permissions.add(perm.permission_name)
                
    return list(permissions)


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
