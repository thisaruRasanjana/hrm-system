"""
documents/services/approval_routing.py
=======================================
Hierarchical, separation-of-duties routing for document approvals & requests.

Rule (confirmed with the product owner):
- A submission from a REGULAR employee (who does NOT hold the manage/approve
  permission) is handled by HR — holders of that permission who are NOT super
  admins. If no such HR user exists, it falls back to super admins.
- A submission from a PRIVILEGED user (who DOES hold the manage/approve
  permission — e.g. HR) escalates to SUPER ADMINS only. No peer may handle it.
- The submitter is never an eligible handler of their own submission.

"Super admin" = a user with the "Super Admin" role OR the is_superadmin flag.

The same logic drives three things per flow so it can't be bypassed:
  1. which pending items a handler sees,
  2. server-side enforcement on approve/reject,
  3. who gets notified.
"""

import logging
from typing import List, Optional, Set

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

SUPER_ADMIN_ROLE_NAME = "Super Admin"


def get_super_admin_user_ids(db: Session) -> Set[int]:
    """Active, non-deleted users who are super admins (role OR flag)."""
    from app.auth.models import User
    from app.roles.models import Role, user_roles

    ids: Set[int] = set()
    try:
        for (uid,) in db.query(User.id).filter(User.is_superadmin == True).all():
            ids.add(uid)

        sa_role = db.query(Role).filter(Role.role_name == SUPER_ADMIN_ROLE_NAME).first()
        if sa_role:
            for (uid,) in db.query(user_roles.c.user_id).filter(user_roles.c.role_id == sa_role.id).all():
                ids.add(uid)
            for (uid,) in db.query(User.id).filter(User.role_id == sa_role.id).all():
                ids.add(uid)

        if not ids:
            return set()

        rows = db.query(User.id).filter(
            User.id.in_(ids),
            (User.is_active == True) | (User.is_active.is_(None)),
            (User.is_deleted == False) | (User.is_deleted.is_(None)),
        ).all()
        return {uid for (uid,) in rows}
    except Exception as e:
        logger.error(f"[ApprovalRouting] super admin resolution failed: {e}")
        return set()


def eligible_handlers_from_sets(
    submitter_user_id: Optional[int],
    approver_ids: Set[int],
    super_admin_ids: Set[int],
) -> Set[int]:
    """Pure partition logic — reused per-item without re-querying."""
    hr_ids = approver_ids - super_admin_ids  # non-super-admin approvers

    submitter_is_privileged = (
        submitter_user_id is not None and submitter_user_id in approver_ids
    )
    if submitter_is_privileged:
        eligible = set(super_admin_ids)            # escalate to super admins only
    else:
        eligible = set(hr_ids) if hr_ids else set(super_admin_ids)  # HR, else super admins

    if submitter_user_id is not None:
        eligible.discard(submitter_user_id)        # never the submitter themselves
    return eligible


def get_eligible_handler_user_ids(
    db: Session, submitter_user_id: Optional[int], manage_permission: str
) -> List[int]:
    """User IDs allowed to handle a submission, given the submitter and the
    permission that governs the flow (document:approve or document:request_manage)."""
    from app.notifications.service import get_user_ids_with_permission

    approver_ids = set(get_user_ids_with_permission(db, manage_permission))
    super_admin_ids = get_super_admin_user_ids(db)
    return list(eligible_handlers_from_sets(submitter_user_id, approver_ids, super_admin_ids))


def can_user_handle(
    db: Session, current_user_id: int, submitter_user_id: Optional[int], manage_permission: str
) -> bool:
    """Whether ``current_user_id`` is allowed to approve/reject this submission."""
    return current_user_id in set(
        get_eligible_handler_user_ids(db, submitter_user_id, manage_permission)
    )


def employee_user_id(db: Session, employee_id: Optional[int]) -> Optional[int]:
    """Resolve an employee's linked user id (the submitter). None if unlinked."""
    if employee_id is None:
        return None
    from app.employees.models import Employee
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    return emp.user_id if emp else None
