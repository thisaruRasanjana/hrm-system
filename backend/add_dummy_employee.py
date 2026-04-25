import sys
import uuid
from sqlalchemy.orm import Session
from app.database.database import SessionLocal
from app.employees.models import Employee

def create_dummy_employee():
    db: Session = SessionLocal()
    target_id = uuid.UUID("3fa85f64-5717-4562-b3fc-2c963f66afa6")
    try:
        # Check if dummy employee exists
        existing = db.query(Employee).filter(Employee.id == target_id).first()
        if existing:
            print(f"Dummy employee already exists with ID: {existing.id}")
            return existing.id

        # Insert dummy employee
        new_employee = Employee(
            id=target_id,
            first_name="Unknown",
            last_name="Employee",
            email="dummy_with_id@example.com",
            role="employee"
        )
        db.add(new_employee)
        db.commit()
        db.refresh(new_employee)
        print(f"Successfully created dummy employee with ID: {new_employee.id}")
        return new_employee.id
    except Exception as e:
        db.rollback()
        print(f"Failed to create dummy employee: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_dummy_employee()
