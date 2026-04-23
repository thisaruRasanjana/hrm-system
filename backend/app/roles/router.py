from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database.session import get_db
from app.core.deps import get_current_user
from app.auth.models import User
from app.roles.models import Role
from app.roles.schemas import RoleCreate, RoleUpdate, RoleResponse

router = APIRouter()

ADMIN_ROLES = {"super_admin", "Admin", "HR Manager", "hr"}


def _require_admin(user: User):
    if user.role not in ADMIN_ROLES and (user.position or "") not in ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")


# ── GET all roles ───────────────────────────────────────────────────────────────
@router.get("/", response_model=List[RoleResponse])
def list_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Role).order_by(Role.name.asc()).all()


# ── POST create role ────────────────────────────────────────────────────────────
@router.post("/", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_role(
    data: RoleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    existing = db.query(Role).filter(Role.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Role name already exists")
    role = Role(name=data.name, permissions=data.permissions, created_by=current_user.id)
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


# ── PUT update role ─────────────────────────────────────────────────────────────
@router.put("/{role_id}", response_model=RoleResponse)
def update_role(
    role_id: int,
    data: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if data.name is not None:
        role.name = data.name
    if data.permissions is not None:
        role.permissions = data.permissions
    db.commit()
    db.refresh(role)
    return role


# ── DELETE role ─────────────────────────────────────────────────────────────────
@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    db.delete(role)
    db.commit()
