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
    from app.leave.models import EmployeeLeaveEntitlement
    
    overridden_ids = {r[0] for r in db.query(EmployeeLeaveEntitlement.employee_id).distinct().all()}
    
    employees = db.query(Employee).options(
        joinedload(Employee.user).joinedload(User.roles)
    ).filter(
        Employee.status == "active",
        (Employee.is_deleted == False) | (Employee.is_deleted == None)
    ).order_by(Employee.last_name, Employee.first_name).all()
    
    for emp in employees:
        emp.has_leave_override = emp.id in overridden_ids
        
    return employees


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

    # Validate any pre-assigned leave entitlements up front so a bad value fails
    # cleanly (400) instead of a rolled-back 500 on an FK/constraint violation,
    # and so negative days can never be stored (mirrors set_employee_leave_entitlements).
    if employee.designation_leave_overrides:
        from app.leave.models import LeaveType as _LeaveType
        _seen_types: set[int] = set()
        for ent in employee.designation_leave_overrides:
            if ent.days is None or ent.days < 0 or ent.days > 365:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Pre-assigned leave days must be between 0 and 365.",
                )
            if ent.leave_type_id in _seen_types:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="The same leave type was pre-assigned more than once.",
                )
            _seen_types.add(ent.leave_type_id)
            if not db.query(_LeaveType).filter(_LeaveType.id == ent.leave_type_id).first():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unknown leave type in pre-assigned entitlements (id {ent.leave_type_id}).",
                )

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

        employee_data = employee.model_dump(exclude={"role_id", "designation_id", "designation_start_date", "designation_end_date", "designation_leave_overrides"})
        db_employee = Employee(**employee_data, user_id=db_user.id)
        db.add(db_employee)
        db.flush()

        # --- Designation history ---
        if employee.designation_id or employee.designation:
            from app.designations.models import Designation as _Designation
            from app.employees.models import EmployeeDesignationHistory
            from datetime import date as _date

            desig_name = employee.designation or ""
            if employee.designation_id:
                d = db.query(_Designation).filter(_Designation.id == employee.designation_id).first()
                if d:
                    desig_name = d.name
                    db_employee.designation = desig_name      # sync string field
                    db_employee.designation_id = employee.designation_id

            hist = EmployeeDesignationHistory(
                employee_id=db_employee.id,
                designation_id=employee.designation_id,
                designation_name=desig_name,
                start_date=employee.designation_start_date or employee.joined_date or _date.today(),
                end_date=employee.designation_end_date,
                leave_overrides=[e.model_dump() for e in employee.designation_leave_overrides] 
                                 if employee.designation_leave_overrides else None,
            )
            db.add(hist)

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

        # ── Notify the new employee ──────────────────────────────────────
        try:
            from app.notifications.service import notify_user
            notify_user(
                db, db_user.id,
                f"Welcome to the team, {db_employee.first_name}!",
                category="system", type="success", link="/dashboard",
                entity_type="employee", entity_id=str(db_employee.id),
            )
            db.commit()
        except Exception as e:
            logger.error(f"Notification failed for new employee: {e}")

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
        
        # Handle designation change
        new_designation_str = update_data.get("designation")
        # In a more complete implementation, you might pass designation_id from the frontend too.
        # But if the string changes, we should capture it.
        designation_changed = False
        if "designation" in update_data and update_data["designation"] != db_employee.designation:
            designation_changed = True
            
        for key, value in update_data.items():
            setattr(db_employee, key, value)
            
        if designation_changed:
            from app.employees.models import EmployeeDesignationHistory
            from datetime import date as _date
            
            # Close the current one
            current_hist = db.query(EmployeeDesignationHistory).filter(
                EmployeeDesignationHistory.employee_id == employee_id,
                EmployeeDesignationHistory.end_date == None
            ).order_by(EmployeeDesignationHistory.start_date.desc()).first()
            
            if current_hist:
                current_hist.end_date = _date.today()
                
            # Create a new one
            new_hist = EmployeeDesignationHistory(
                employee_id=employee_id,
                designation_id=None, # if not provided
                designation_name=new_designation_str or "",
                start_date=_date.today(),
                end_date=None,
                leave_overrides=None,
            )
            db.add(new_hist)

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


def get_designation_history(db: Session, employee_id: int):
    from app.employees.models import EmployeeDesignationHistory
    return db.query(EmployeeDesignationHistory)\
             .filter(EmployeeDesignationHistory.employee_id == employee_id)\
             .order_by(EmployeeDesignationHistory.start_date.desc())\
             .all()
