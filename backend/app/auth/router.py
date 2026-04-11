from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database.database import get_db
from app.auth import schemas, service

router = APIRouter(prefix="/auth", tags=["auth"])

@router.get("/roles", response_model=List[schemas.RoleRead])
def read_roles(db: Session = Depends(get_db)):
    return service.get_roles(db)

@router.get("/permissions", response_model=List[schemas.PermissionRead])
def read_permissions(db: Session = Depends(get_db)):
    return service.get_permissions(db)

@router.post("/roles", response_model=schemas.RoleRead)
def create_custom_role(role: schemas.RoleCreate, db: Session = Depends(get_db)):
    return service.create_role(db, role)

@router.post("/assign")
def assign_role_to_employee(assignment: schemas.RoleAssignment, db: Session = Depends(get_db)):
    employee = service.assign_role(db, assignment)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"message": f"Role assigned to employee {employee.first_name}"}

@router.put("/roles/{role_id}", response_model=schemas.RoleRead)
def update_role_permissions(role_id: int, role_update: schemas.RoleUpdate, db: Session = Depends(get_db)):
    updated_role = service.update_role(db, role_id, role_update)
    if not updated_role:
        raise HTTPException(status_code=404, detail="Role not found")
    return updated_role
