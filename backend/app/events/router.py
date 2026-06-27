from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.database.database import get_db
from app.core.deps import get_current_user, require_permission
from app.auth.models import User
from app.events.models import Event, UserCalendarEvent
from app.events.schemas import EventCreate, EventUpdate, EventResponse, EventWithStatus

router = APIRouter()


# ── GET upcoming events only (future dates) ─────────────────────────────────────
@router.get("", response_model=List[EventWithStatus])
def list_events(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns future events only. Past events are automatically excluded."""
    now = datetime.utcnow()
    events = (
        db.query(Event)
        .filter(Event.event_date >= now)
        .order_by(Event.event_date.asc())
        .all()
    )
    
    # Check which events are saved by the current user
    saved_event_ids = set(
        db.query(UserCalendarEvent.event_id)
        .filter(UserCalendarEvent.user_id == current_user.id)
        .all()
    )
    saved_event_ids = {id[0] for id in saved_event_ids}

    return [
        EventWithStatus(
            id=ev.id,
            title=ev.title,
            description=ev.description,
            event_date=ev.event_date,
            location=ev.location,
            created_by=ev.created_by,
            created_at=ev.created_at,
            is_saved=(ev.id in saved_event_ids)
        ) for ev in events
    ]


# ── GET all events including past — used by Calendar widget ────────────────────
@router.get("/all", response_model=List[EventResponse])
def list_all_events(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns all events (past + future). Used by CalendarWidget."""
    return db.query(Event).order_by(Event.event_date.asc()).all()


@router.get("/my-calendar", response_model=List[EventResponse])
def list_my_calendar_events(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns events explicitly saved by the user to their calendar."""
    return (
        db.query(Event)
        .join(UserCalendarEvent, Event.id == UserCalendarEvent.event_id)
        .filter(UserCalendarEvent.user_id == current_user.id)
        .order_by(Event.event_date.asc())
        .all()
    )


@router.post("/{event_id}/save", status_code=status.HTTP_201_CREATED)
def save_event_to_calendar(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check if already saved
    existing = db.query(UserCalendarEvent).filter(
        UserCalendarEvent.user_id == current_user.id,
        UserCalendarEvent.event_id == event_id
    ).first()
    if existing:
        return {"message": "Already saved"}
    
    save = UserCalendarEvent(user_id=current_user.id, event_id=event_id)
    db.add(save)
    db.commit()
    return {"message": "Saved to calendar"}


@router.delete("/{event_id}/save", status_code=status.HTTP_204_NO_CONTENT)
def remove_event_from_calendar(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    save = db.query(UserCalendarEvent).filter(
        UserCalendarEvent.user_id == current_user.id,
        UserCalendarEvent.event_id == event_id
    ).first()
    if save:
        db.delete(save)
        db.commit()
    return


# ── POST — requires widget.upcoming_events.manage ──────────────────────────────
@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(
    data: EventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("widget.upcoming_events.manage")),
):
    event = Event(
        title=data.title,
        description=data.description,
        event_date=data.event_date,
        location=data.location,
        created_by=current_user.id,
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    try:
        from app.auth.models import User
        from app.notifications.service import notify_users
        
        # Notify all active users about the new event
        all_users = db.query(User.id).filter(User.is_active == True).all()
        user_ids = [u[0] for u in all_users if u[0] != current_user.id]
        
        if user_ids:
            notify_users(
                db, 
                user_ids, 
                f"New upcoming event: {event.title}", 
                category="events",
                link="/dashboard#widget-upcoming_events",
                entity_type="event",
                entity_id=str(event.id)
            )
            db.commit()
    except Exception as e:
        import logging
        logging.error(f"Failed to notify users of new event: {e}")

    return event


# ── PUT — requires widget.upcoming_events.manage ───────────────────────────────
@router.put("/{event_id}", response_model=EventResponse)
def update_event(
    event_id: int,
    data: EventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("widget.upcoming_events.manage")),
):
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(ev, field, value)
    db.commit()
    db.refresh(ev)
    return ev


# ── DELETE — requires widget.upcoming_events.manage ───────────────────────────
@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("widget.upcoming_events.manage")),
):
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(ev)
    db.commit()
