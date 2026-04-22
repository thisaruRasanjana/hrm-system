from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.deps import get_db
from .models import Employee

router = APIRouter(
    prefix="/employees",
    tags=["Employees"]
)

# GET all employees
@router.get("/")
def get_employees(db: Session = Depends(get_db)):
    employees = db.query(Employee).all()

    return [
        {
            "id": emp.id,
            "first_name": emp.first_name,
            "last_name": emp.last_name
        }
        for emp in employees
    ]


# CREATE employee
@router.post("/")
def create_employee(first_name: str, last_name: str, db: Session = Depends(get_db)):

    new_employee = Employee(
        first_name=first_name,
        last_name=last_name
    )

    db.add(new_employee)
    db.commit()
    db.refresh(new_employee)

    return {
        "id": new_employee.id,
        "first_name": new_employee.first_name,
        "last_name": new_employee.last_name
    }