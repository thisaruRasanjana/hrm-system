"""
notifications/service.py
========================
Transaction-safe notification helpers.

All functions in this module are designed to be called IN-PROCESS (same DB
session as the triggering action) so notifications commit atomically with
the event.  They never raise exceptions — errors are logged and swallowed
so the parent action always succeeds.

Usage:
    from app.notifications.service import notify_user, notify_permission
    notify_user(db, user_id, "Hello!", category="system")
"""

import logging
import threading
from datetime import datetime
from typing import Optional, List

from sqlalchemy import event, func
from sqlalchemy.orm import Session

from app.notifications.models import Notification

logger = logging.getLogger(__name__)

# Categories that are ALWAYS delivered in-app (cannot be disabled by user prefs)
ALWAYS_DELIVER_CATEGORIES = {"security", "system"}


# ── Preference Helpers ──────────────────────────────────────────────────────

def _get_user_prefs(user) -> Optional[dict]:
    """Return the notification_preferences JSON dict or None."""
    prefs = getattr(user, "notification_preferences", None)
    if isinstance(prefs, dict):
        return prefs
    return None


def _should_deliver_in_app(user, category: Optional[str]) -> bool:
    """
    Decide whether an in-app notification should be created for this user/category.

    Rules:
    - security and system categories are ALWAYS delivered.
    - Missing/null preferences → treat all categories as enabled.
    - If category's inApp is explicitly False → skip.
    """
    if category in ALWAYS_DELIVER_CATEGORIES:
        return True

    prefs = _get_user_prefs(user)
    if prefs is None:
        return True  # No preferences set → default all enabled

    cat_prefs = prefs.get(category)
    if cat_prefs is None:
        return True  # Category not configured → default enabled

    return cat_prefs.get("inApp", True)


def _should_send_email(user, category: Optional[str]) -> bool:
    """
    Decide whether an email notification should be sent for this user/category.

    Rules:
    - If the category's email switch is explicitly False → skip.
    - Otherwise → send (unconfigured categories default to enabled).
    """
    prefs = _get_user_prefs(user)
    cat_prefs = prefs.get(category) if prefs else None

    if cat_prefs is not None and not cat_prefs.get("email", True):
        return False

    return True


# ── Email Delivery ─────────────────────────────────────────────────────────
#
# Emails are staged on the Session and only sent once that session COMMITS.
# Two rules drive this design:
#
#   1. Never email about something that didn't happen. notify_* deliberately
#      does not commit — the caller's transaction does. Sending inline would
#      email the user even if the caller then rolled back.
#   2. Never make a user wait for SMTP. Sending is handed to a background
#      thread, so a slow or dead mail server cannot stall the HTTP response.

_EMAIL_QUEUE_KEY = "pending_notification_emails"


def _queue_email(db: Session, user, message: str, category: Optional[str], link: Optional[str]) -> None:
    """Stage a notification email to be sent if and when this session commits."""
    try:
        # Belt-and-suspenders: never email a soft-deleted or deactivated account.
        # notify_* already resolve recipients through the global soft-delete query
        # filter, but this is the single boundary every notification email funnels
        # through, so we re-check here to also cover a user object that reached us
        # via a relationship load (which the query filter intentionally skips).
        if getattr(user, "is_deleted", False) or getattr(user, "is_active", True) is False:
            return
        to = getattr(user, "email", None)
        if not to or not _should_send_email(user, category):
            return
        db.info.setdefault(_EMAIL_QUEUE_KEY, []).append((to, message, category, link))
    except Exception as e:
        logger.error(f"[Notifications] Failed to queue email: {e}")


def _send_queued(queue: List[tuple]) -> None:
    """
    Send staged emails one by one. Runs off-request; never raises.

    Collapses duplicates so a mailbox receives a given message once per batch.
    Notifications are per-user, but several user accounts can share one email
    address, which would otherwise deliver the same announcement to that
    address once per account.
    """
    from app.core.email import send_notification_email

    seen: set = set()
    for to, message, category, link in queue:
        key = (to.strip().lower(), message)
        if key in seen:
            continue
        seen.add(key)
        try:
            send_notification_email(to, message, category=category, link=link)
        except Exception as e:
            # A failed email must never surface to the user — the in-app
            # notification is already delivered and is the source of truth.
            logger.error(f"[Notifications] Email to {to} failed: {e}")


@event.listens_for(Session, "after_commit")
def _dispatch_notification_emails(session: Session) -> None:
    """Once the notification rows are durable, hand their emails to a thread."""
    queue = session.info.pop(_EMAIL_QUEUE_KEY, None)
    if not queue:
        return
    try:
        threading.Thread(target=_send_queued, args=(queue,), daemon=True).start()
    except Exception as e:
        logger.error(f"[Notifications] Failed to start email thread: {e}")


@event.listens_for(Session, "after_rollback")
def _discard_notification_emails(session: Session) -> None:
    """The action was rolled back, so its emails must never go out."""
    session.info.pop(_EMAIL_QUEUE_KEY, None)


# ── Recipient Resolution ───────────────────────────────────────────────────

def get_user_ids_with_permission(db: Session, permission: str) -> List[int]:
    """
    Return the user IDs that effectively hold `permission`.

    This MIRRORS the authoritative resolver app.core.deps.get_user_permissions
    so notifications reach exactly the people who can act on them:

    - Users assigned to a role that grants the permission — via the many-to-many
      ``user_roles`` join table OR the scalar ``users.role_id`` fallback column
      (legacy / migration rows that were never inserted into the join table).
    - Superadmins, EXCEPT for self-service permissions in SUPER_ADMIN_EXCLUDES
      (which superadmins are not treated as holding).
    - Only active, non-deleted accounts are returned.
    """
    from app.auth.models import User
    from app.roles.models import Permission, role_permissions, user_roles
    from app.roles.seed import SUPER_ADMIN_EXCLUDES

    try:
        # Roles that grant this permission
        role_ids = [
            rid for (rid,) in (
                db.query(role_permissions.c.role_id)
                .join(Permission, role_permissions.c.permission_id == Permission.id)
                .filter(Permission.permission_name == permission)
                .distinct()
                .all()
            )
        ]

        user_ids: set[int] = set()
        if role_ids:
            # Primary path — many-to-many user_roles join table
            for (uid,) in (
                db.query(user_roles.c.user_id)
                .filter(user_roles.c.role_id.in_(role_ids))
                .distinct()
                .all()
            ):
                user_ids.add(uid)
            # Fallback — scalar role_id column (legacy / migration gaps)
            for (uid,) in db.query(User.id).filter(User.role_id.in_(role_ids)).all():
                user_ids.add(uid)

        # Superadmins implicitly hold every permission except self-service ones
        if permission not in SUPER_ADMIN_EXCLUDES:
            for (uid,) in db.query(User.id).filter(User.is_superadmin == True).all():
                user_ids.add(uid)

        if not user_ids:
            return []

        # Restrict to active, non-deleted accounts
        rows = (
            db.query(User.id)
            .filter(
                User.id.in_(user_ids),
                (User.is_active == True) | (User.is_active.is_(None)),
                (User.is_deleted == False) | (User.is_deleted.is_(None)),
            )
            .all()
        )
        return [uid for (uid,) in rows]
    except Exception as e:
        logger.error(f"[Notifications] Failed to resolve permission '{permission}': {e}")
        return []


# ── Core Notification Functions ────────────────────────────────────────────

def notify_user(
    db: Session,
    user_id: int,
    message: str,
    *,
    category: Optional[str] = None,
    type: str = "info",
    link: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
) -> Optional[Notification]:
    """
    Create a single in-app notification for a user, respecting their preferences.

    Returns the created Notification or None if skipped/failed.
    Never raises exceptions.
    """
    try:
        from app.auth.models import User
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            logger.warning(f"[Notifications] User {user_id} not found, skipping notification")
            return None

        # Email and in-app are independent switches in Settings → Notifications,
        # so a user who turned off in-app but left email on still gets mailed.
        # Staged, not sent: goes out only if the caller's transaction commits.
        _queue_email(db, user, message, category, link)

        if not _should_deliver_in_app(user, category):
            return None

        notif = Notification(
            user_id=user_id,
            message=message,
            type=type,
            link=link,
            category=category,
            entity_type=entity_type,
            entity_id=entity_id,
        )
        db.add(notif)
        # Don't commit — the caller's transaction will commit both the action and the notification
        return notif
    except Exception as e:
        logger.error(f"[Notifications] Failed to notify user {user_id}: {e}")
        return None


def notify_users(
    db: Session,
    user_ids: List[int],
    message: str,
    *,
    category: Optional[str] = None,
    type: str = "info",
    link: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    exclude_user_id: Optional[int] = None,
) -> int:
    """
    Bulk-create in-app notifications for multiple users.
    Uses a single add_all for performance (e.g. announcement fan-out).

    ``exclude_user_id`` drops the acting user so people are never notified
    about their own action.

    Returns count of notifications created. Never raises exceptions.
    """
    try:
        from app.auth.models import User
        users = db.query(User).filter(User.id.in_(user_ids)).all()
        user_map = {u.id: u for u in users}

        notifications = []
        for uid in user_ids:
            if exclude_user_id is not None and uid == exclude_user_id:
                continue
            user = user_map.get(uid)
            if not user:
                continue
            # Independent of the in-app switch — see notify_user.
            _queue_email(db, user, message, category, link)

            if not _should_deliver_in_app(user, category):
                continue
            notifications.append(Notification(
                user_id=uid,
                message=message,
                type=type,
                link=link,
                category=category,
                entity_type=entity_type,
                entity_id=entity_id,
            ))

        if notifications:
            db.add_all(notifications)
        return len(notifications)
    except Exception as e:
        logger.error(f"[Notifications] Failed to bulk notify {len(user_ids)} users: {e}")
        return 0


def notify_employee(
    db: Session,
    employee_id: int,
    message: str,
    *,
    category: Optional[str] = None,
    type: str = "info",
    link: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
) -> Optional[Notification]:
    """
    Notify an employee by resolving Employee.user_id.
    Skips silently if the employee has no linked user account.

    Never raises exceptions.
    """
    try:
        from app.employees.models import Employee
        emp = db.query(Employee).filter(Employee.id == employee_id).first()
        if not emp or not emp.user_id:
            return None

        return notify_user(
            db,
            emp.user_id,
            message,
            category=category,
            type=type,
            link=link,
            entity_type=entity_type,
            entity_id=entity_id,
        )
    except Exception as e:
        logger.error(f"[Notifications] Failed to notify employee {employee_id}: {e}")
        return None


def notify_permission(
    db: Session,
    permission: str,
    message: str,
    *,
    category: Optional[str] = None,
    type: str = "info",
    link: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    exclude_user_id: Optional[int] = None,
    exclude_employee_id: Optional[int] = None,
) -> int:
    """
    Notify all users who hold a given permission (via their roles).
    This is how "notify HR/approvers" works.

    The acting user is excluded so they're never notified about their own
    action — pass ``exclude_user_id`` (a user id) or ``exclude_employee_id``
    (an employee id, resolved to its linked user) for the person who triggered
    the event.

    Returns count of notifications created. Never raises exceptions.
    """
    try:
        user_ids = get_user_ids_with_permission(db, permission)
        if not user_ids:
            return 0

        # Resolve the acting user so they don't get notified about their own action
        actor_user_id = exclude_user_id
        if actor_user_id is None and exclude_employee_id is not None:
            from app.employees.models import Employee
            emp = db.query(Employee).filter(Employee.id == exclude_employee_id).first()
            if emp:
                actor_user_id = emp.user_id

        return notify_users(
            db,
            user_ids,
            message,
            category=category,
            type=type,
            link=link,
            entity_type=entity_type,
            entity_id=entity_id,
            exclude_user_id=actor_user_id,
        )
    except Exception as e:
        logger.error(f"[Notifications] Failed to notify by permission '{permission}': {e}")
        return 0


# ── Once-Per-Day Guards ────────────────────────────────────────────────────

def already_notified_today(db: Session, entity_type: str, entity_id: str) -> bool:
    """
    Has a notification for this entity already gone out today?

    Daily reminders must be idempotent: the loops that send them re-run on every
    process start, and an in-memory guard is wiped by each restart (uvicorn
    --reload restarts on every code save), which would re-send the same reminder
    all day. The notifications table itself is the only guard that survives a
    restart, so it is the source of truth.

    ``entity_type`` must be specific to the reminder (e.g. "event_reminder", not
    "event") so a reminder is not confused with other notifications about the
    same entity — such as the "New upcoming event" message for that event.

    Returns True (i.e. "skip sending") on error, because re-sending a duplicate
    is worse than missing one reminder.
    """
    try:
        return (
            db.query(Notification.id)
            .filter(
                Notification.entity_type == entity_type,
                Notification.entity_id == str(entity_id),
                func.date(Notification.created_at) == func.current_date(),
            )
            .first()
            is not None
        )
    except Exception as e:
        logger.error(
            f"[Notifications] Dedupe check failed for {entity_type}/{entity_id}: {e}"
        )
        return True


# ── Retention / Auto-Cleanup ───────────────────────────────────────────────

# Retention windows offered in Settings → Notifications, in days.
# None (never) is represented by a NULL notification_retention_days column.
RETENTION_CHOICES = {30, 90, 180, 365}


def purge_expired_notifications(db: Session) -> int:
    """
    Permanently delete notifications older than each user's retention window.

    Users with a NULL ``notification_retention_days`` keep everything forever.
    Purged rows are gone for good — this is the "cannot be restored" path the
    settings copy warns about, so it only ever acts on the window the user
    themselves chose.

    Returns the number of rows deleted. Never raises.
    """
    from datetime import timedelta

    try:
        from app.auth.models import User

        total = 0
        rows = (
            db.query(User.id, User.notification_retention_days)
            .filter(User.notification_retention_days.isnot(None))
            .all()
        )
        for user_id, days in rows:
            if not days or days not in RETENTION_CHOICES:
                continue
            cutoff = datetime.now() - timedelta(days=days)
            deleted = (
                db.query(Notification)
                .filter(
                    Notification.user_id == user_id,
                    Notification.created_at < cutoff,
                )
                .delete(synchronize_session=False)
            )
            total += deleted or 0

        if total:
            db.commit()
        return total
    except Exception as e:
        logger.error(f"[Notifications] Retention purge failed: {e}")
        try:
            db.rollback()
        except Exception:
            pass
        return 0


def get_employee_name(db: Session, employee_id: int) -> str:
    """Helper to get '{first_name} {last_name}' for an employee. Returns 'Unknown' on failure."""
    try:
        from app.employees.models import Employee
        emp = db.query(Employee).filter(Employee.id == employee_id).first()
        if emp:
            return f"{emp.first_name} {emp.last_name}"
    except Exception:
        pass
    return "Unknown"
