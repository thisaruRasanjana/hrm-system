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
from app.employees import email as _email_module

logger = logging.getLogger(__name__)


def get_employees(db: Session, skip: int = 0, limit: int = 100):
    from sqlalchemy.orm import joinedload
    return db.query(Employee).options(
        joinedload(Employee.department_rel),
        joinedload(Employee.user).joinedload(User.roles)
    ).filter(
        (Employee.is_deleted == False) | (Employee.is_deleted == None)
    ).offset(skip).limit(limit).all()


def get_employee_by_id(db: Session, employee_id: int):
    from sqlalchemy.orm import joinedload
    return db.query(Employee).options(
        joinedload(Employee.department_rel),
        joinedload(Employee.user).joinedload(User.roles)
    ).filter(
        Employee.id == employee_id,
        (Employee.is_deleted == False) | (Employee.is_deleted == None)
    ).first()


def get_all_employees(db: Session):
    """Return all non-deleted employees ordered by name. Used by recruitment panel dropdowns."""
    from sqlalchemy.orm import joinedload
    return db.query(Employee).options(
        joinedload(Employee.department_rel),
        joinedload(Employee.user).joinedload(User.roles)
    ).filter(
        (Employee.is_deleted == False) | (Employee.is_deleted == None)
    ).order_by(Employee.last_name, Employee.first_name).all()


def get_active_employees(db: Session):
    """Return only active employees. Used by recruitment interview panel dropdowns."""
    from sqlalchemy.orm import joinedload
    return db.query(Employee).options(
        joinedload(Employee.user).joinedload(User.roles)
    ).filter(
        Employee.status == "active",
        (Employee.is_deleted == False) | (Employee.is_deleted == None)
    ).order_by(Employee.last_name, Employee.first_name).all()


def create_employee(db: Session, employee: EmployeeCreate, background_tasks: BackgroundTasks):
    """
    Unified creation flow:
    1. Create User account with random password
    2. Create Employee record linked to User
    3. Assign initial Role to User
    4. Send welcome email after commit (via BackgroundTasks)
    """
    def _tombstone(value, pk, max_len=255):
        """Free a unique column on a soft-deleted row without deleting it.
        Rows can't be hard-deleted: audit_logs (and other tables) hold FK
        references to users/employees."""
        if not value or str(value).startswith("deleted_"):
            return value
        return f"deleted_{pk}_{value}"[:max_len]

    try:
        # Rename unique fields on any soft-deleted user/employee with this email
        # so the unique constraints don't block re-creation of the account.
        stale_user = db.query(User).filter(
            User.email == employee.email,
            User.is_deleted == True
        ).first()
        if stale_user:
            stale_emp = db.query(Employee).filter(Employee.user_id == stale_user.id).first()
            if stale_emp:
                stale_emp.email = _tombstone(stale_emp.email, stale_emp.id)
                stale_emp.employee_id = _tombstone(stale_emp.employee_id, stale_emp.id, max_len=50)
                stale_emp.is_deleted = True
            stale_user.email = _tombstone(stale_user.email, stale_user.id)
            stale_user.username = _tombstone(stale_user.username, stale_user.id)
            db.flush()

        # Also free any orphaned soft-deleted employee row with this email
        stale_emp_only = db.query(Employee).filter(
            Employee.email == employee.email,
            Employee.is_deleted == True
        ).first()
        if stale_emp_only:
            stale_emp_only.email = _tombstone(stale_emp_only.email, stale_emp_only.id)
            stale_emp_only.employee_id = _tombstone(stale_emp_only.employee_id, stale_emp_only.id, max_len=50)
            db.flush()

        temp_password = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))
        hashed = hash_password(temp_password)

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
        db.flush()

        employee_data = employee.model_dump(exclude={"role_id"})
        db_employee = Employee(**employee_data, user_id=db_user.id)
        db.add(db_employee)
        db.flush()

        # Eager-load permissions so the relationship is fully populated after commit
        from sqlalchemy.orm import joinedload as _jl
        role = db.query(Role).options(_jl(Role.permissions)).filter(Role.id == employee.role_id).first()
        if not role:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Role ID {employee.role_id} not found"
            )

        db_user.roles = [role]
        db_user.role_id = role.id

        from app.departments.models import Department
        dept = db.query(Department).filter(Department.id == employee.department_id).first()
        if dept:
            db_user.department = dept.name

        db.commit()
        db.refresh(db_employee)

        full_name = f"{db_employee.first_name} {db_employee.last_name}"
        background_tasks.add_task(_email_module.send_welcome_email, db_employee.email, full_name, temp_password)

        return db_employee

    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create employee/user: {str(e)}")

        error_msg = str(e).lower()
        if "ix_users_email" in error_msg or ("unique constraint" in error_msg and "email" in error_msg):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This email is already used.")
        if "ix_employees_employee_id" in error_msg or "employee_id" in error_msg:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This Employee ID is already used.")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Employee creation failed: {str(e)}")


def update_employee(db: Session, employee_id: int, employee_update: EmployeeUpdate):
    db_employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if db_employee:
        update_data = employee_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_employee, key, value)

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
            if "department_id" in update_data:
                db.flush()
                if db_employee.department_rel:
                    user.department = db_employee.department_rel.name

        db.commit()
        db.refresh(db_employee)
    return db_employee


def delete_employee(db: Session, employee_id: int):
    db_employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if db_employee:
        db_employee.is_deleted = True
        if db_employee.user:
            db_employee.user.is_deleted = True
        db.commit()
        return True
    return False


def deactivate_employee(db: Session, employee_id: int) -> dict:
    """Soft-deactivate used by recruitment module."""
    db_employee = get_employee_by_id(db, employee_id)
    if not db_employee:
        raise HTTPException(status_code=404, detail="Employee not found.")
    db_employee.status = "inactive"
    db.commit()
    return {"message": f"Employee {employee_id} deactivated successfully."}
