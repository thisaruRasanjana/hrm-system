from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from typing import List
from app.database.database import get_db
from app.departments.models import Department
from app.departments.schemas import DepartmentOut, DepartmentCreate
from app.core.deps import get_current_user, require_any_permission
from app.auth.models import User
from app.employees.models import Employee

router = APIRouter()

@router.get("/", response_model=List[DepartmentOut])
def get_departments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Department).order_by(Department.name).all()


@router.post("/", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
def create_department(
    payload: DepartmentCreate,
    db: Session = Depends(get_db),
    # Whoever can add or edit employees may also create the departments they need.
    current_user: User = Depends(require_any_permission("employee:create", "employee:update")),
):
    """Create a new department. Companies define their own — none are hardcoded."""
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Department name is required")

    existing = db.query(Department).filter(func.lower(Department.name) == name.lower()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A department with that name already exists")

    department = Department(name=name)
    db.add(department)
    try:
        db.commit()
        db.refresh(department)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A department with that name already exists")
    return department

@router.delete("/{department_id}", status_code=status.HTTP_200_OK)
def delete_department(
    department_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("employee:create", "employee:update")),
):
    """Delete a department. Blocked while employees are still assigned to it."""
    department = db.query(Department).filter(Department.id == department_id).first()
    if not department:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    # Only ACTIVE employees block deletion — soft-deleted ones no longer count.
    assigned = db.query(Employee).filter(
        Employee.department_id == department_id,
        (Employee.is_deleted == False) | (Employee.is_deleted == None),
    ).count()
    if assigned > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete: {assigned} employee(s) are assigned to this department. Reassign them first.",
        )

    # Clear the department from any soft-deleted employees still referencing it,
    # otherwise the foreign key would block the delete.
    db.query(Employee).filter(Employee.department_id == department_id).update(
        {Employee.department_id: None}, synchronize_session=False
    )
    db.delete(department)
    db.commit()
    return {"deleted": True}


@router.get("/{department_id}", response_model=DepartmentOut)
def get_department(
    department_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_dept = db.query(Department).filter(Department.id == department_id).first()
    if not db_dept:
        raise HTTPException(status_code=404, detail="Department not found")
    return db_dept
