"""
Employee Module — Service Layer

Pure database logic. All functions take a SQLAlchemy Session and return
either a model instance / list or raise HTTPException on known error states.
Keeping business logic here (not in the router) maintains clean MVC separation.
"""

from sqlalchemy.orm import Session
from fastapi import HTTPException

from .models import Employee
from .schemas import EmployeeCreate, EmployeeUpdate


# ── Read Operations ────────────────────────────────────────────────────────────

def get_all_employees(db: Session) -> list[Employee]:
    """
    Return all employee records ordered by last name then first name.
    Used by the panel setup page to populate dropdown lists.
    """
    return (
        db.query(Employee)
        .order_by(Employee.last_name, Employee.first_name)
        .all()
    )


def get_active_employees(db: Session) -> list[Employee]:
    """
    Return only active employees (is_active = 1).
    Only active staff should appear in interview panel dropdowns.
    """
    return (
        db.query(Employee)
        .filter(Employee.is_active == 1)
        .order_by(Employee.last_name, Employee.first_name)
        .all()
    )


def get_employee_by_id(db: Session, employee_id: int) -> Employee:
    """
    Fetch a single employee by primary key.
    Raises HTTP 404 if not found so the router stays thin.
    """
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found.")
    return employee


# ── Write Operations ───────────────────────────────────────────────────────────

def create_employee(db: Session, data: EmployeeCreate) -> Employee:
    """
    Persist a new employee record.

    Checks for duplicate email before inserting to return a clear error
    rather than letting the DB unique constraint surface a 500.
    """
    if data.email:
        existing = db.query(Employee).filter(Employee.email == data.email).first()
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"An employee with email '{data.email}' already exists.",
            )

    try:
        employee = Employee(**data.model_dump())
        db.add(employee)
        db.commit()
        db.refresh(employee)
        return employee
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to create employee record.",
        ) from exc


def update_employee(db: Session, employee_id: int, data: EmployeeUpdate) -> Employee:
    """
    Apply a partial update to an existing employee record (PATCH semantics).
    Only fields explicitly set in the payload are modified.
    """
    employee = get_employee_by_id(db, employee_id)

    update_fields = data.model_dump(exclude_unset=True)
    for field, value in update_fields.items():
        setattr(employee, field, value)

    try:
        db.commit()
        db.refresh(employee)
        return employee
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to update employee record.",
        ) from exc


def deactivate_employee(db: Session, employee_id: int) -> dict:
    """
    Soft-delete an employee by setting is_active = 0.
    A hard delete is intentionally avoided because employees are referenced
    by historical interview panel records.
    """
    employee = get_employee_by_id(db, employee_id)
    employee.is_active = 0

    try:
        db.commit()
        return {"message": f"Employee {employee_id} deactivated successfully."}
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to deactivate employee.",
        ) from exc
