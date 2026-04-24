from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from app.database.database import get_db
from app.core.deps import get_current_user
from app.auth.models import User
from app.dashboard.schemas import DashboardLayoutResponse, DashboardLayoutUpdate
from app.dashboard.service import get_layout, save_layout

router = APIRouter()

# ── Role → allowed widget keys ──────────────────────────────────────────────────
# Key: user.role or user.position value as stored in DB
ROLE_WIDGET_CONFIG: Dict[str, List[str]] = {
    # HR managers / admins see everything
    "super_admin": [
        "time_tracking", "leave_balance", "notifications", "weekly_hours",
        "availability", "calendar", "approval_summary", "announcements", "upcoming_events",
    ],
    "Admin": [
        "time_tracking", "leave_balance", "notifications", "weekly_hours",
        "availability", "calendar", "approval_summary", "announcements", "upcoming_events",
    ],
    "HR Manager": [
        "time_tracking", "leave_balance", "notifications", "weekly_hours",
        "availability", "calendar", "approval_summary", "announcements", "upcoming_events",
    ],
    "hr": [
        "time_tracking", "leave_balance", "notifications", "weekly_hours",
        "availability", "calendar", "approval_summary", "announcements", "upcoming_events",
    ],
    # Employees / team leads have a reduced set (no approval_summary)
    "employee": [
        "time_tracking", "leave_balance", "notifications", "weekly_hours",
        "calendar", "announcements", "upcoming_events",
    ],
    "Team Lead": [
        "time_tracking", "leave_balance", "notifications", "weekly_hours",
        "availability", "calendar", "announcements", "upcoming_events",
    ],
    # Default fallback
    "_default": [
        "time_tracking", "leave_balance", "notifications", "weekly_hours",
        "calendar", "announcements", "upcoming_events",
    ],
}

DEFAULT_LAYOUT = [
    {"i": "time_tracking",    "x": 0, "y": 0, "w": 4, "h": 3},
    {"i": "leave_balance",    "x": 4, "y": 0, "w": 4, "h": 3},
    {"i": "notifications",    "x": 8, "y": 0, "w": 4, "h": 3},
    {"i": "weekly_hours",     "x": 0, "y": 3, "w": 4, "h": 3},
    {"i": "availability",     "x": 4, "y": 3, "w": 4, "h": 3},
    {"i": "calendar",         "x": 8, "y": 3, "w": 4, "h": 3},
    {"i": "approval_summary", "x": 0, "y": 6, "w": 4, "h": 3},
    {"i": "announcements",    "x": 4, "y": 6, "w": 4, "h": 3},
    {"i": "upcoming_events",  "x": 8, "y": 6, "w": 4, "h": 3},
]


def _allowed_widgets(user: User) -> List[str]:
    """Return the widget key list for this user's role/position."""
    role_key = user.role or "_default"
    position_key = user.position or ""
    # Try role first, then position, then default
    return (
        ROLE_WIDGET_CONFIG.get(role_key)
        or ROLE_WIDGET_CONFIG.get(position_key)
        or ROLE_WIDGET_CONFIG["_default"]
    )


# ── GET layout ─────────────────────────────────────────────────────────────────
@router.get("/layout", response_model=DashboardLayoutResponse)
def get_dashboard_layout(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allowed = _allowed_widgets(current_user)
    saved = get_layout(db, current_user.id)

    if saved:
        # Filter saved layout to only include currently-allowed widgets
        filtered = [w for w in saved if w.get("i") in allowed]
    else:
        # Return role-appropriate default layout
        filtered = [w for w in DEFAULT_LAYOUT if w["i"] in allowed]

    return {"widgets": filtered, "role": current_user.role, "allowed_widgets": allowed}


# ── POST / save layout ─────────────────────────────────────────────────────────
@router.post("/layout", response_model=DashboardLayoutResponse)
def update_dashboard_layout(
    data: DashboardLayoutUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allowed = _allowed_widgets(current_user)
    # Only persist widgets the user is actually allowed to have
    safe_widgets = [w for w in data.widgets if w.get("i") in allowed]
    saved = save_layout(db, current_user.id, safe_widgets)
    return {"widgets": saved, "role": current_user.role, "allowed_widgets": allowed}