"""
auth/router.py — Authentication endpoints only.
Role/Permission endpoints are in roles/router.py.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List

from app.database.database import get_db
from app.auth import schemas, service
from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.core import security

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=schemas.Token)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = service.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = security.create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=schemas.UserMe)
def read_users_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Flatten roles and permissions
    roles = [r.role_name for r in current_user.roles]
    permissions = service.get_user_permissions(db, current_user.id)
    
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "roles": roles,
        "permissions": permissions,
        "features": {}  # Dashboard flags can be added here
    }


@router.get("/users/{user_id}/permissions", response_model=schemas.UserPermissionsOut)
def get_user_permissions(user_id: int, db: Session = Depends(get_db)):
    """Return the flat list of permission strings for a user."""
    perms = service.get_user_permissions(db, user_id)
    return {"user_id": user_id, "permissions": perms}
