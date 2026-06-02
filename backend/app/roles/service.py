"""
roles/service.py — Business logic for role and permission management.
No business logic lives in router.py; it all lives here.
"""
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.roles.models import Permission, Role
from app.roles.schemas import RoleCreate, RoleUpdate, AssignRoleRequest


# ---------------------------------------------------------------------------
# Permissions
# ---------------------------------------------------------------------------

def get_all_permissions(db: Session) -> List[Permission]:
    return db.query(Permission).order_by(Permission.permission_name).all()


# ---------------------------------------------------------------------------
# Roles
# ---------------------------------------------------------------------------

def get_all_roles(db: Session) -> List[Role]:
    return db.query(Role).order_by(Role.role_name).all()


def get_role_by_id(db: Session, role_id: int) -> Role:
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    return role


def create_role(db: Session, payload: RoleCreate) -> Role:
    # Validate unique name
    existing = db.query(Role).filter_by(role_name=payload.role_name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Role '{payload.role_name}' already exists",
        )

    # Validate permission IDs
    permissions = _resolve_permissions(db, payload.permission_ids)

    role = Role(role_name=payload.role_name, description=payload.description)
    role.permissions = permissions
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


def update_role(db: Session, role_id: int, payload: RoleUpdate) -> Role:
    role = get_role_by_id(db, role_id)

    if payload.role_name is not None:
        # Validate name uniqueness (allow same role to keep its name)
        conflict = (
            db.query(Role)
            .filter(Role.role_name == payload.role_name, Role.id != role_id)
            .first()
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Role name '{payload.role_name}' is already taken",
            )
        role.role_name = payload.role_name

    if payload.description is not None:
        role.description = payload.description

    if payload.permission_ids is not None:
        role.permissions = _resolve_permissions(db, payload.permission_ids)

    db.commit()
    db.refresh(role)
    return role


# ---------------------------------------------------------------------------
# Assign roles to user
# ---------------------------------------------------------------------------

def assign_roles_to_user(db: Session, payload: AssignRoleRequest) -> dict:
    from app.auth.models import User  # local import — avoids circular dependency
    from sqlalchemy.orm import joinedload

    from app.roles.models import Role
    # Eager-load the user's existing roles so SQLAlchemy can diff the join table correctly
    user = (
        db.query(User)
        .options(joinedload(User.roles).joinedload(Role.permissions))
        .filter(User.id == payload.user_id)
        .first()
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {payload.user_id} not found",
        )

    roles = _resolve_roles(db, payload.role_ids)

    # Full replacement of user's roles
    user.roles = roles
    if roles:
        user.role_id = roles[0].id
        user.role = roles[0].role_name  # keep original casing for display
    else:
        user.role_id = None
        user.role = None

    db.commit()

    # Re-fetch with eager loads so the returned object is fully populated
    user = (
        db.query(User)
        .options(joinedload(User.roles).joinedload(Role.permissions))
        .filter(User.id == payload.user_id)
        .first()
    )
    return {"user_id": user.id, "assigned_role_ids": [r.id for r in user.roles], "role_name": user.roles[0].role_name if user.roles else None}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _resolve_permissions(db: Session, ids: List[int]) -> List[Permission]:
    if not ids:
        return []
    perms = db.query(Permission).filter(Permission.id.in_(ids)).all()
    found_ids = {p.id for p in perms}
    missing = set(ids) - found_ids
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Permission IDs not found: {sorted(missing)}",
        )
    return perms


def _resolve_roles(db: Session, ids: List[int]) -> List[Role]:
    if not ids:
        return []
    roles = db.query(Role).filter(Role.id.in_(ids)).all()
    found_ids = {r.id for r in roles}
    missing = set(ids) - found_ids
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Role IDs not found: {sorted(missing)}",
        )
    return roles
