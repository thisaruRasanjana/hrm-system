import sys
import os

# Add the parent directory to sys.path so we can import from 'app'
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database.database import SessionLocal
from app.auth import models
from app.employees.models import Employee # Explicitly import to register with Base

def seed_rbac():
    db = SessionLocal()
    try:
        # 1. Define Permissions
        permissions_data = {
            "Employee Management": [
                "View Own Profile", "Edit Own Profile", "View All Employees", 
                "Add Employee", "Edit Employee Details", "Delete Employee", "Export Employee Data"
            ],
            "Leave Management": [
                "View Own Leaves", "Apply Leave", "Cancel Own Leave", "View Team Leaves", 
                "Approve Leave Requests", "Reject Leave Requests", "Manage Leave Types"
            ],
            "Document Management": [
                "View Own Documents", "Upload Documents", "Request Documents", 
                "View All Documents", "Approve Documents", "Generate Documents", "Manage Templates"
            ]
        }

        all_perms = []
        for category, perms in permissions_data.items():
            for perm_name in perms:
                existing = db.query(models.Permission).filter(models.Permission.name == perm_name).first()
                if not existing:
                    p = models.Permission(name=perm_name, description=f"{category} Permission")
                    db.add(p)
                    all_perms.append(p)
                else:
                    all_perms.append(existing)
        
        db.commit()
        print("Permissions seeded.")

        # 2. Define Roles
        roles_data = [
            {
                "name": "Employee",
                "description": "Standard access for regular staff members",
                "permissions": ["View Own Profile", "Edit Own Profile", "View Own Leaves", "Apply Leave", "Cancel Own Leave", "View Own Documents", "Upload Documents"]
            },
            {
                "name": "Manager",
                "description": "Advanced access for team leads and department heads",
                "permissions": ["View Own Profile", "View All Employees", "Edit Employee Details", "View Team Leaves", "Approve Leave Requests", "View Own Documents", "Upload Documents", "Request Documents"]
            },
            {
                "name": "HR",
                "description": "Full access to employee management and payroll",
                "permissions": ["View All Employees", "Add Employee", "Edit Employee Details", "Export Employee Data", "Approve Leave Requests", "Reject Leave Requests", "Manage Leave Types", "View All Documents", "Approve Documents"]
            },
            {
                "name": "Super Admin",
                "description": "Complete system access and configuration rights",
                "permissions": [p.name for p in all_perms] # All permissions
            }
        ]

        for role_info in roles_data:
            existing_role = db.query(models.Role).filter(models.Role.name == role_info["name"]).first()
            if not existing_role:
                # Fetch permission objects
                role_perms = db.query(models.Permission).filter(models.Permission.name.in_(role_info["permissions"])).all()
                r = models.Role(
                    name=role_info["name"],
                    description=role_info["description"],
                    is_system=1,
                    permissions=role_perms
                )
                db.add(r)
        
        db.commit()
        print("Roles seeded.")

    except Exception as e:
        print(f"Error seeding RBAC: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_rbac()
