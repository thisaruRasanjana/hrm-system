from sqlalchemy.orm import Session
from app.employees.models import Employee
from app.employees.schemas import EmployeeCreate, EmployeeUpdate

import secrets
import string
import logging
from fastapi import HTTPException, status, BackgroundTasks
from app.auth.models import User
from app.roles.models import Role
from app.core.security import hash_password
from app.employees.email import send_welcome_email

logger = logging.getLogger(__name__)

def get_employees(db: Session, skip: int = 0, limit: int = 100):
    from sqlalchemy.orm import joinedload
    return db.query(Employee).options(joinedload(Employee.department_rel)).filter(
        (Employee.is_deleted == False) | (Employee.is_deleted == None)
    ).offset(skip).limit(limit).all()

def get_employee_by_id(db: Session, employee_id: int):
    return db.query(Employee).filter(
        Employee.id == employee_id,
        (Employee.is_deleted == False) | (Employee.is_deleted == None)
    ).first()

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
            is_active=True,
            first_name=employee.first_name,
            last_name=employee.last_name,
            employee_id=employee.employee_id,
            phone_number=employee.phone,
            address=employee.address,
            date_of_birth=str(employee.date_of_birth) if employee.date_of_birth else None,
            emergency_contact_number=employee.emergency_contact_phone,
            position=employee.designation
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
        db_user.role_id = role.id
        
        # 5. Sync department name to User string field
        from app.departments.models import Department
        dept = db.query(Department).filter(Department.id == employee.department_id).first()
        if dept:
            db_user.department = dept.name
        
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
        
        # Check for unique constraint violations (duplicate email or ID)
        error_msg = str(e).lower()
        if "ix_users_email" in error_msg or "unique constraint" in error_msg and "email" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This email is already used."
            )
        if "ix_employees_employee_id" in error_msg or "employee_id" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This Employee ID is already used."
            )

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
        
        # Sync with User record
        if db_employee.user:
            user = db_employee.user
            if "first_name" in update_data: user.first_name = update_data["first_name"]
            if "last_name" in update_data: user.last_name = update_data["last_name"]
            if "email" in update_data:
                user.email = update_data["email"]
                user.username = update_data["email"]
            if "phone" in update_data: user.phone_number = update_data["phone"]
            if "address" in update_data: user.address = update_data["address"]
            if "date_of_birth" in update_data: user.date_of_birth = str(update_data["date_of_birth"])
            if "emergency_contact_phone" in update_data: user.emergency_contact_number = update_data["emergency_contact_phone"]
            if "employee_id" in update_data: user.employee_id = update_data["employee_id"]
            if "designation" in update_data: user.position = update_data["designation"]
            
            # Update department name if changed
            if "department_id" in update_data:
                db.flush() # Ensure relationship is loaded
                if db_employee.department_rel:
                    user.department = db_employee.department_rel.name

        db.commit()
        db.refresh(db_employee)
    return db_employee

def delete_employee(db: Session, employee_id: int):
    db_employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if db_employee:
        # Soft delete both Employee and User
        db_employee.is_deleted = True
        if db_employee.user:
            db_employee.user.is_deleted = True
            # Free up email and username for reuse by appending timestamp or similar
            # Or rely on partial index if implemented. 
            # To be safe across all DB types, we can also rename
            # but partial index is preferred for Postgres.
        db.commit()
        return True
    return False
