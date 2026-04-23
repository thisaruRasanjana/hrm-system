from fastapi import APIRouter, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.core.deps import get_current_user
from app.auth.models import User

router = APIRouter()


# ── GET leave balance (stub) ───────────────────────────────────────────────────
@router.get("/balance")
def get_leave_balance(
    current_user: User = Depends(get_current_user),
):
    """
    Stub endpoint returning mock leave balance data.
    Replace with real DB queries when the leave model is fully implemented.
    """
    return {
        "annual": {"used": 8, "total": 20},
        "sick": {"used": 2, "total": 10},
        "casual": {"used": 1, "total": 7},
    }
