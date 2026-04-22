from sqlalchemy.orm import Session
from app.auth import models, schemas
from app.employees.models import Employee

def get_roles(db: Session):
    return db.query(models.Role).all()

def get_permissions(db: Session):
    return db.query(models.Permission).all()

def create_role(db: Session, role_in: schemas.RoleCreate):
    permissions = db.query(models.Permission).filter(models.Permission.name.in_(role_in.permissions)).all()
    db_role = models.Role(
        name=role_in.name,
        description=role_in.description,
        is_system=role_in.is_system,
        permissions=permissions
    )
    db.add(db_role)
    db.commit()
    db.refresh(db_role)
    return db_role

def assign_role(db: Session, assignment: schemas.RoleAssignment):
    employee = db.query(Employee).filter(Employee.id == assignment.employee_id).first()
    if not employee:
        return None
    employee.role_id = assignment.role_id
    db.commit()
    db.refresh(employee)
    return employee

def update_role(db: Session, role_id: int, role_update: schemas.RoleUpdate):
    db_role = db.query(models.Role).filter(models.Role.id == role_id).first()
    if not db_role:
        return None
    
    # Resolve permission names to permission objects
    permissions = db.query(models.Permission).filter(models.Permission.name.in_(role_update.permissions)).all()
    db_role.permissions = permissions
    db.commit()
    db.refresh(db_role)
    return db_role
