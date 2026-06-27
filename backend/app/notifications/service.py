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
from datetime import datetime, time
from typing import Optional, List

from sqlalchemy.orm import Session

from app.notifications.models import Notification

logger = logging.getLogger(__name__)

# Categories that are ALWAYS delivered in-app (cannot be disabled by user prefs)
ALWAYS_DELIVER_CATEGORIES = {"security", "system"}

# Categories that ignore quiet hours entirely
IGNORE_QUIET_HOURS_CATEGORIES = {"security"}


# ── Preference / Quiet-Hours Helpers ────────────────────────────────────────

def _parse_time(time_str: Optional[str]) -> Optional[time]:
    """Parse an 'HH:MM' string into a datetime.time object."""
    if not time_str:
        return None
    try:
        parts = time_str.strip().split(":")
        return time(int(parts[0]), int(parts[1]))
    except (ValueError, IndexError):
        return None


def _is_in_quiet_hours(user) -> bool:
    """
    Check if the current server time falls within the user's quiet-hour window.
    Handles midnight wrapping (e.g. 22:00 → 08:00).
    """
    start = _parse_time(getattr(user, "quiet_hours_start", None))
    end = _parse_time(getattr(user, "quiet_hours_end", None))
    if start is None or end is None:
        return False

    now = datetime.now().time()

    if start <= end:
        # Simple range: e.g. 09:00 → 17:00
        return start <= now <= end
    else:
        # Wraps midnight: e.g. 22:00 → 08:00
        return now >= start or now <= end


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
    - Missing/null preferences → treat email as enabled (but won't actually
      send unless the caller has an email sender to call).
    - If category's email is explicitly False → skip.
    - Quiet hours suppress email for non-urgent categories.
    """
    prefs = _get_user_prefs(user)
    if prefs is None:
        return True

    cat_prefs = prefs.get(category)
    if cat_prefs is None:
        return True

    if not cat_prefs.get("email", True):
        return False

    # Quiet hours suppress email for non-urgent categories
    if category not in IGNORE_QUIET_HOURS_CATEGORIES and _is_in_quiet_hours(user):
        return False

    return True


# ── Recipient Resolution ───────────────────────────────────────────────────

def get_user_ids_with_permission(db: Session, permission: str) -> List[int]:
    """
    Return a list of user IDs that hold a given permission via their roles.
    Also includes superadmins (who implicitly have all permissions).
    """
    from app.auth.models import User
    from app.roles.models import Permission, role_permissions, user_roles

    try:
        # Users who have the permission via role → role_permissions → permissions
        user_ids_via_roles = (
            db.query(user_roles.c.user_id)
            .join(role_permissions, user_roles.c.role_id == role_permissions.c.role_id)
            .join(Permission, role_permissions.c.permission_id == Permission.id)
            .filter(Permission.permission_name == permission)
            .distinct()
        ).all()

        result = {uid for (uid,) in user_ids_via_roles}

        # Also include superadmins
        superadmins = (
            db.query(User.id)
            .filter(User.is_superadmin == True, User.is_active == True)
            .all()
        )
        for (uid,) in superadmins:
            result.add(uid)

        return list(result)
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
) -> int:
    """
    Bulk-create in-app notifications for multiple users.
    Uses a single add_all for performance (e.g. announcement fan-out).

    Returns count of notifications created. Never raises exceptions.
    """
    try:
        from app.auth.models import User
        users = db.query(User).filter(User.id.in_(user_ids)).all()
        user_map = {u.id: u for u in users}

        notifications = []
        for uid in user_ids:
            user = user_map.get(uid)
            if not user:
                continue
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
) -> int:
    """
    Notify all users who hold a given permission (via their roles).
    This is how "notify HR/approvers" works.

    Returns count of notifications created. Never raises exceptions.
    """
    try:
        user_ids = get_user_ids_with_permission(db, permission)
        if not user_ids:
            return 0

        return notify_users(
            db,
            user_ids,
            message,
            category=category,
            type=type,
            link=link,
            entity_type=entity_type,
            entity_id=entity_id,
        )
    except Exception as e:
        logger.error(f"[Notifications] Failed to notify by permission '{permission}': {e}")
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
