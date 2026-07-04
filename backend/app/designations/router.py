from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from typing import List

from app.database.database import get_db
from app.designations.models import Designation
from app.designations.schemas import DesignationOut, DesignationCreate
from app.core.deps import get_current_user, require_any_permission
from app.auth.models import User
from app.employees.models import Employee

router = APIRouter()

@router.get("/", response_model=List[DesignationOut])
def get_designations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Designation).order_by(Designation.name).all()


@router.post("/", response_model=DesignationOut, status_code=status.HTTP_201_CREATED)
def create_designation(
    payload: DesignationCreate,
    db: Session = Depends(get_db),
    # Whoever can add or edit employees may also create the designations they need.
    current_user: User = Depends(require_any_permission("employee:create", "employee:update")),
):
    """Create a new designation."""
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Designation name is required")

    existing = db.query(Designation).filter(func.lower(Designation.name) == name.lower()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A designation with that name already exists")

    designation = Designation(name=name)
    db.add(designation)
    try:
        db.commit()
        db.refresh(designation)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A designation with that name already exists")
    return designation


@router.delete("/{designation_id}", status_code=status.HTTP_200_OK)
def delete_designation(
    designation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("employee:create", "employee:update")),
):
    """Delete a designation. Blocked while employees are still assigned to it."""
    designation = db.query(Designation).filter(Designation.id == designation_id).first()
    if not designation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Designation not found")

    # Only ACTIVE employees block deletion
    assigned = db.query(Employee).filter(
        Employee.designation_id == designation_id,
        (Employee.is_deleted == False) | (Employee.is_deleted == None),
    ).count()
    if assigned > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete: {assigned} employee(s) are assigned to this designation. Reassign them first.",
        )

    # Clear from soft-deleted employees
    db.query(Employee).filter(Employee.designation_id == designation_id).update(
        {Employee.designation_id: None}, synchronize_session=False
    )
    db.delete(designation)
    db.commit()
    return {"deleted": True}


@router.get("/{designation_id}", response_model=DesignationOut)
def get_designation(
    designation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_desig = db.query(Designation).filter(Designation.id == designation_id).first()
    if not db_desig:
        raise HTTPException(status_code=404, detail="Designation not found")
    return db_desig
