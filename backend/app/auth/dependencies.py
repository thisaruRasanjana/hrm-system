from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.core import security
from app.auth import service
from app.auth.models import User

# Use the login endpoint (to be implemented in Step 5) as the token URL
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

def get_current_user(
    request: Request,
    db: Session = Depends(get_db), 
    token: str = Depends(oauth2_scheme)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    actual_token = token or request.query_params.get("token")
    if not actual_token:
        raise credentials_exception
    
    payload = security.decode_access_token(actual_token)
    if payload is None:
        raise credentials_exception
    
    user_id: int = payload.get("sub")
    if user_id is None:
        raise credentials_exception
        
    user = service.get_user_by_id(db, user_id=int(user_id))
    if user is None:
        raise credentials_exception
        
    return user

def require_permission(permission_name: str):
    """
    Dependency factory that returns a dependency function 
    to check if the current user has a specific permission.
    """
    def permission_checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ):
        permissions = service.get_user_permissions(db, current_user.id)
        if permission_name not in permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permission: {permission_name}"
            )
        return current_user
        
    return permission_checker
