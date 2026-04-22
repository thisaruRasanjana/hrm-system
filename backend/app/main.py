from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database.database import engine, SessionLocal
from app.database.base import Base

# Import all models so SQLAlchemy registers them before create_all
from app.employees.models import Employee          # noqa: F401
from app.auth.models import Role, Permission       # noqa: F401

from app.employees.router import router as employee_router
from app.auth.router import router as auth_router


def seed_default_data():
    """Seed roles and permissions if they don't exist yet."""
    db = SessionLocal()
    try:
        if db.query(Permission).count() > 0:
            return  # Already seeded

        # Default permissions
        default_permissions = [
            Permission(name="employee:view",   description="Employee Permission"),
            Permission(name="employee:create", description="Employee Permission"),
            Permission(name="employee:edit",   description="Employee Permission"),
            Permission(name="employee:delete", description="Employee Permission"),
            Permission(name="leave:view",      description="Leave Permission"),
            Permission(name="leave:approve",   description="Leave Permission"),
            Permission(name="document:view",   description="Document Permission"),
            Permission(name="document:upload", description="Document Permission"),
            Permission(name="document:approve",description="Document Permission"),
            Permission(name="recruitment:view",description="Recruitment Permission"),
            Permission(name="recruitment:manage",description="Recruitment Permission"),
            Permission(name="report:view",     description="Report Permission"),
        ]
        db.add_all(default_permissions)
        db.commit()

        # Reload to get IDs
        all_perms = db.query(Permission).all()
        emp_perms = [p for p in all_perms if "employee" in p.name]
        all_perms_set = all_perms

        # Default roles
        hr_manager = Role(name="HR Manager", description="Full HR access", is_system=1,
                          permissions=all_perms_set)
        employee_role = Role(name="Employee", description="Standard employee access", is_system=1,
                             permissions=[p for p in all_perms if p.name in ("employee:view", "document:view", "document:upload", "leave:view")])
        admin_role = Role(name="Admin", description="System administrator", is_system=1,
                          permissions=all_perms_set)
        manager_role = Role(name="Manager", description="Department manager access", is_system=1,
                            permissions=[p for p in all_perms if p.name in ("employee:view", "employee:edit", "leave:view", "leave:approve", "document:view", "report:view")])

        db.add_all([hr_manager, employee_role, admin_role, manager_role])
        db.commit()
        print("[Seed] Default roles and permissions created.")
    except Exception as e:
        db.rollback()
        print(f"[Seed] Skipped (already seeded or error): {e}")
    finally:
        db.close()


# Create all tables
Base.metadata.create_all(bind=engine)

# Seed default data
seed_default_data()

app = FastAPI(title="HRM Backend")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "HRM backend with DB connected"}

app.include_router(employee_router)
app.include_router(auth_router)