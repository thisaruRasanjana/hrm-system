from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List

from app.database.database import get_db
from app.roles import schemas, service
from app.core.deps import get_current_user, require_permission

router = APIRouter()


@router.get("/permissions", response_model=List[schemas.PermissionOut], summary="List all system permissions", dependencies=[Depends(require_permission("role:view"))])
def list_permissions(db: Session = Depends(get_db)):
    return service.get_all_permissions(db)


@router.get("/", response_model=List[schemas.RoleOut], summary="List all roles", dependencies=[Depends(require_permission("role:view"))])
def list_roles(db: Session = Depends(get_db)):
    return service.get_all_roles(db)


@router.get("/{role_id}", response_model=schemas.RoleOut, summary="Get a single role", dependencies=[Depends(require_permission("role:view"))])
def get_role(role_id: int, db: Session = Depends(get_db)):
    return service.get_role_by_id(db, role_id)


@router.post("/", response_model=schemas.RoleOut, status_code=status.HTTP_201_CREATED, summary="Create a new role", dependencies=[Depends(require_permission("role:create"))])
def create_role(payload: schemas.RoleCreate, db: Session = Depends(get_db)):
    return service.create_role(db, payload)


@router.put("/{role_id}", response_model=schemas.RoleOut, summary="Update a role (partial)", dependencies=[Depends(require_permission("role:create"))])
def update_role(role_id: int, payload: schemas.RoleUpdate, db: Session = Depends(get_db)):
    return service.update_role(db, role_id, payload)


@router.post("/assign", summary="Assign roles to a user (replaces existing roles)", dependencies=[Depends(require_permission("role:assign"))])
def assign_roles(payload: schemas.AssignRoleRequest, db: Session = Depends(get_db)):
    return service.assign_roles_to_user(db, payload)
