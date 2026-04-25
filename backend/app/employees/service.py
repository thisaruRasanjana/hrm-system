from sqlalchemy.orm import Session
from app.employees.models import Employee
from app.employees.schemas import EmployeeCreate, EmployeeUpdate

import secrets
import string
import logging
from fastapi import HTTPException, status, BackgroundTasks
from app.auth.models import User
from app.roles.models import Role
from app.auth.utils import hash_password
from app.employees.email import send_welcome_email

logger = logging.getLogger(__name__)


def get_employees(db: Session, skip: int = 0, limit: int = 100):
    # Eager load role and user for the schema
    return db.query(Employee).offset(skip).limit(limit).all()


def get_employee_by_id(db: Session, employee_id: int):
    return db.query(Employee).filter(Employee.id == employee_id).first()


def create_employee(db: Session, employee: EmployeeCreate, background_tasks: BackgroundTasks):
    """
    Unified creation flow:
    1. Create User account with random password
    2. Create Employee record linked to User
    3. Assign initial Role to User
    4. Send welcome email after commit (via BackgroundTasks)
    """
    try:
        # 1. Generate temp password and hash it
        temp_password = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))
        hashed = hash_password(temp_password)

        # 2. Create User record
        db_user = User(
            username=employee.email,
            email=employee.email,
            password_hash=hashed,
            is_active=True
        )
        db.add(db_user)
        db.flush()  # Get db_user.id

        # 3. Create Employee record
        employee_data = employee.model_dump(exclude={"role_id"})
        db_employee = Employee(
            **employee_data,
            user_id=db_user.id
        )
        db.add(db_employee)
        db.flush()  # Get db_employee.id

        # 4. Assign Role
        role = db.query(Role).filter(Role.id == employee.role_id).first()
        if not role:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Role ID {employee.role_id} not found"
            )

        db_user.roles = [role]

        # 5. Finalize transaction
        db.commit()
        db.refresh(db_employee)

        # 6. Send welcome email in background
        full_name = f"{db_employee.first_name} {db_employee.last_name}"
        background_tasks.add_task(send_welcome_email, db_employee.email, full_name, temp_password)

        return db_employee

    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create employee/user: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Employee creation failed: {str(e)}"
        )


def update_employee(db: Session, employee_id: int, employee_update: EmployeeUpdate):
    db_employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if db_employee:
        update_data = employee_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_employee, key, value)
        db.commit()
        db.refresh(db_employee)
    return db_employee


def delete_employee(db: Session, employee_id: int):
    db_employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if db_employee:
        db.delete(db_employee)
        db.commit()
        return True
    return False
