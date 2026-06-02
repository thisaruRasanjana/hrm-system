from sqlalchemy.orm import Session
from app.dashboard.models import DashboardLayout


def get_layout(db: Session, user_id: int):

    layout = db.query(DashboardLayout).filter(
        DashboardLayout.user_id == user_id
    ).first()

    if not layout:
        return None

    return layout.layout


def save_layout(db: Session, user_id: int, widgets):

    layout = db.query(DashboardLayout).filter(
        DashboardLayout.user_id == user_id
    ).first()

    if layout:
        layout.layout = widgets
    else:
        layout = DashboardLayout(
            user_id=user_id,
            layout=widgets
        )
        db.add(layout)

    db.commit()

    return widgets