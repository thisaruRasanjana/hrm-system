from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from app.database.database import get_db
from app.employees import service, schemas
from app.core.deps import get_current_user, require_permission

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/", response_model=List[schemas.EmployeeOut], dependencies=[Depends(require_permission("employee:view_all"))])
def read_employees(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return service.get_employees(db, skip=skip, limit=limit)


@router.get("/panel-options", response_model=List[schemas.EmployeePanelOption])
def list_panel_options(db: Session = Depends(get_db)):
    """Return minimal active employee data for recruitment interview panel dropdowns."""
    return service.get_active_employees(db)


@router.get("/{employee_id}", response_model=schemas.EmployeeOut, dependencies=[Depends(require_permission("employee:view_all"))])
def read_employee(employee_id: int, db: Session = Depends(get_db)):
    db_employee = service.get_employee_by_id(db, employee_id=employee_id)
    if db_employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    return db_employee


@router.post("/", response_model=schemas.EmployeeOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("employee:create"))])
def create_employee(
    employee: schemas.EmployeeCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    return service.create_employee(db, employee, background_tasks)


@router.put("/{employee_id}", response_model=schemas.EmployeeOut, dependencies=[Depends(require_permission("employee:update"))])
def update_employee(employee_id: int, employee_update: schemas.EmployeeUpdate, db: Session = Depends(get_db)):
    db_employee = service.update_employee(db=db, employee_id=employee_id, employee_update=employee_update)
    if db_employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    return db_employee


@router.delete("/{employee_id}", dependencies=[Depends(require_permission("employee:delete"))])
def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    success = service.delete_employee(db=db, employee_id=employee_id)
    if not success:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"success": True, "message": "Employee deleted successfully"}


@router.post("/test-email", dependencies=[Depends(require_permission("employee:create"))])
def test_email(email: str):
    """Trigger a test welcome email to a specific address."""
    from app.employees.email import send_welcome_email
    send_welcome_email(email, "Test Admin", "test-password-123")
    return {"message": f"Test email triggered for {email}. Check backend logs for results."}


@router.get("/{employee_id}/designation-history", 
            response_model=List[schemas.DesignationHistoryEntry],
            dependencies=[Depends(require_permission("employee:view_all"))])
def get_designation_history(employee_id: int, db: Session = Depends(get_db)):
    return service.get_designation_history(db, employee_id)
