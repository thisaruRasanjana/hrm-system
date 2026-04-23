from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.employees.models import Employee


def get_current_user(
    x_user_id: str = Header(...),
    x_user_roles: str = Header(...),
):
    return {
        "id": int(x_user_id),
        "role": x_user_roles.strip().lower(),
    }


def require_roles(allowed_roles: list[str]):
    def checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in [r.lower() for r in allowed_roles]:
            raise HTTPException(status_code=403, detail="Access denied")
        return current_user
    return checker