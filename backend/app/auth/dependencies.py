from fastapi import Header, HTTPException, Depends, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.employees.models import Employee
from app.auth.models import Role, Permission

def get_current_user(x_employee_id: str = Header(default=None), db: Session = Depends(get_db)):
    """
    Retrieves the current user based on the X-Employee-ID header.
    Expects the integer DB id of the employee (e.g. 6, 7, 8, 9).
    """
    if not x_employee_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Authentication required (X-Employee-ID header missing)"
        )
    
    try:
        emp_id = int(x_employee_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Employee ID format (expected integer)")
        
    employee = db.query(Employee).filter(Employee.id == emp_id).first()
    if not employee:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        
    return employee

def require_permission(permission_key: str):
    """
    Dependency factory to check if the current user's role has the required permission.
    Usage: current_user: Employee = Depends(require_permission("document:upload"))
    """
    def permission_checker(current_user: Employee = Depends(get_current_user), db: Session = Depends(get_db)):
        if not current_user.role_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User has no role assigned")
            
        # Fetch the role and joined permissions
        role = db.query(Role).filter(Role.id == current_user.role_id).first()
        if not role:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Assigned role not found")
            
        # Check permissions list
        permission_names = [p.name for p in role.permissions]
        
        if permission_key not in permission_names:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail=f"Forbidden: Missing required permission '{permission_key}'"
            )
            
        return current_user
        
    return permission_checker
