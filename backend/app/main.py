import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database.database import engine, SessionLocal
from app.database.base import Base

# Import models so tables are registered
from app.employees.models import Employee
from app.auth.models import Role, Permission
from app.documents.models.model import EmployeeDocument
from app.documents.models.template_model import DocumentTemplate
from app.documents.models.document_type_model import DocumentType
from app.documents.models.audit_log_model import DocumentAuditLog

# Routers
from app.employees.router import router as employee_router
from app.auth.router import router as auth_router
from app.documents.routers.router import router as documents_router
from app.documents.routers import request_router
from app.documents.routers.hr_request_router import router as hr_request_router
from app.documents.routers.approval_router import router as approval_router
from app.documents.routers.template_router import router as template_router
from app.documents.routers.document_type_router import router as document_type_router

EMAIL_POLL_INTERVAL = 60  # seconds between each email check

async def email_polling_loop():
    """Runs in the background and polls Gmail inbox every EMAIL_POLL_INTERVAL seconds."""
    await asyncio.sleep(5)
    while True:
        try:
            from app.documents.services import email_service
            db = SessionLocal()
            # Run the synchronous email fetching in a separate thread to avoid blocking the event loop
            result = await asyncio.to_thread(email_service.fetch_and_process_external_requests, db)
            db.close()
            
            if isinstance(result, int) and result > 0:
                print(f"[Email Poller] Synced {result} new external email request(s).")
            elif isinstance(result, dict) and result.get("status") == "error":
                print(f"[Email Poller] Service Error: {result.get('message')}")
        except Exception as e:
            print(f"[Email Poller] Loop Error: {e}")
        await asyncio.sleep(EMAIL_POLL_INTERVAL)

def seed_default_data():
    """Seed roles and permissions if they don't exist yet."""
    db = SessionLocal()
    try:
        existing_perms = {p.name for p in db.query(Permission).all()}
        default_permissions = [
            Permission(name="employee:view",   description="Employee Permission"),
            Permission(name="employee:create", description="Employee Permission"),
            Permission(name="employee:edit",   description="Employee Permission"),
            Permission(name="employee:delete", description="Employee Permission"),
            Permission(name="leave:view",      description="Leave Permission"),
            Permission(name="leave:approve",   description="Leave Permission"),
            Permission(name="document:view",   description="Document Permission"),
            Permission(name="document:upload", description="Document Permission"),
            Permission(name="document:request",description="Document Permission"),
            Permission(name="document:approve",description="Document Permission"),
            Permission(name="document:manage_types",description="Document Permission"),
            Permission(name="document:manage_templates",description="Document Permission"),
            Permission(name="recruitment:view",description="Recruitment Permission"),
            Permission(name="recruitment:manage",description="Recruitment Permission"),
            Permission(name="report:view",     description="Report Permission"),
        ]
        
        new_perms = [p for p in default_permissions if p.name not in existing_perms]
        if new_perms:
            db.add_all(new_perms)
            db.commit()

        all_perms = db.query(Permission).all()
        
        existing_roles = {r.name: r for r in db.query(Role).all()}
        
        if "HR Manager" not in existing_roles:
            hr_manager = Role(name="HR Manager", description="Full HR access", is_system=1, permissions=all_perms)
            db.add(hr_manager)
        else:
            existing_roles["HR Manager"].permissions = all_perms
            
        if "Employee" not in existing_roles:
            employee_role = Role(name="Employee", description="Standard employee access", is_system=1,
                                 permissions=[p for p in all_perms if p.name in ("employee:view", "document:view", "document:upload", "leave:view")])
            db.add(employee_role)
            
        if "Admin" not in existing_roles:
            admin_role = Role(name="Admin", description="System administrator", is_system=1, permissions=all_perms)
            db.add(admin_role)
            
        if "Manager" not in existing_roles:
            manager_role = Role(name="Manager", description="Department manager access", is_system=1,
                                permissions=[p for p in all_perms if p.name in ("employee:view", "employee:edit", "leave:view", "leave:approve", "document:view", "report:view")])
            db.add(manager_role)

        db.commit()
        print("[Seed] Default roles and permissions synced.")
    except Exception as e:
        db.rollback()
        print(f"[Seed] Skipped: {e}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_default_data()
    task = asyncio.create_task(email_polling_loop())
    print("[Email Poller] Background email polling started (every 60 seconds).")
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    print("[Email Poller] Background email polling stopped.")

app = FastAPI(
    title="HRM Backend",
    description="HRMS Document Management API",
    version="1.0.0",
    lifespan=lifespan
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(employee_router)
app.include_router(auth_router)
app.include_router(documents_router)
app.include_router(request_router.router)
app.include_router(hr_request_router)
app.include_router(approval_router)
app.include_router(template_router)
app.include_router(document_type_router)

@app.get("/")
def root():
    return {
        "message": "HRM Backend Running",
        "status": "OK"
    }