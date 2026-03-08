from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dashboard.schemas import (
    DashboardLayoutResponse,
    DashboardLayoutUpdate,
)
from app.dashboard.service import get_layout, save_layout


router = APIRouter()


# Get dashboard layout
@router.get("/layout", response_model=DashboardLayoutResponse)
def get_dashboard_layout(
    user_id: int,
    db: Session = Depends(get_db)
):

    layout = get_layout(db, user_id)

    if not layout:
        return {"widgets": []}

    return {"widgets": layout}


# Save dashboard layout
@router.post("/layout", response_model=DashboardLayoutResponse)
def update_dashboard_layout(
    data: DashboardLayoutUpdate,
    user_id: int,
    db: Session = Depends(get_db)
):

    widgets = save_layout(db, user_id, data.widgets)

    return {"widgets": widgets}