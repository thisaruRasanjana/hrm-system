"""
Employee Module — API Router

Thin routing layer: validates HTTP concerns (path params, status codes) and
delegates all business logic to the service module. No DB queries here.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.deps import get_db
from . import schemas, service

router = APIRouter(prefix="/employees", tags=["Employees"])


# ── Read Endpoints ─────────────────────────────────────────────────────────────

@router.get("/", response_model=list[schemas.EmployeeResponse])
def list_employees(db: Session = Depends(get_db)):
    """
    Return all employee records, ordered by last name.
    Used by HR admin screens.
    """
    return service.get_all_employees(db)


@router.get("/panel-options", response_model=list[schemas.EmployeePanelOption])
def list_panel_options(db: Session = Depends(get_db)):
    """
    Return a minimal subset of active employee data for interview panel dropdowns.
    Intentionally returns less data than the full employee list for safety.
    """
    return service.get_active_employees(db)


@router.get("/{employee_id}", response_model=schemas.EmployeeResponse)
def get_employee(employee_id: int, db: Session = Depends(get_db)):
    """Fetch a single employee by ID. Returns 404 if not found."""
    return service.get_employee_by_id(db, employee_id)


# ── Write Endpoints ────────────────────────────────────────────────────────────

@router.post("/", response_model=schemas.EmployeeResponse, status_code=201)
def create_employee(data: schemas.EmployeeCreate, db: Session = Depends(get_db)):
    """
    Create a new employee record.
    Returns 409 if an employee with the same email already exists.
    """
    return service.create_employee(db, data)


@router.patch("/{employee_id}", response_model=schemas.EmployeeResponse)
def update_employee(
    employee_id: int,
    data: schemas.EmployeeUpdate,
    db: Session = Depends(get_db),
):
    """
    Partially update an employee record.
    Only fields included in the request body are modified.
    """
    return service.update_employee(db, employee_id, data)


@router.delete("/{employee_id}")
def deactivate_employee(employee_id: int, db: Session = Depends(get_db)):
    """
    Soft-delete an employee by marking them inactive.
    Hard delete is intentionally not supported to preserve audit history.
    """
    return service.deactivate_employee(db, employee_id)