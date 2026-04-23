from fastapi import APIRouter, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.auth.models import User

router = APIRouter()


# ── GET leave balance (stub) ───────────────────────────────────────────────────
@router.get("/balance")
def get_leave_balance(
    db: Session = Depends(get_db),
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
