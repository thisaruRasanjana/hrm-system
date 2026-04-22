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

# Routers
from app.employees.router import router as employee_router
from app.auth.router import router as auth_router
from app.documents.routers.router import router as documents_router
from app.documents.routers import request_router
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
            result = email_service.fetch_and_process_external_requests(db)
            db.close()
            if result.get("processed_emails", 0) > 0:
                print(f"[Email Poller] Synced {result['processed_emails']} new external email request(s).")
        except Exception as e:
            print(f"[Email Poller] Error: {e}")
        await asyncio.sleep(EMAIL_POLL_INTERVAL)

def seed_default_data():
    """Seed roles and permissions if they don't exist yet."""
    db = SessionLocal()
    try:
        if db.query(Permission).count() > 0:
            return

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
        db.add_all(default_permissions)
        db.commit()

        all_perms = db.query(Permission).all()
        hr_manager = Role(name="HR Manager", description="Full HR access", is_system=1, permissions=all_perms)
        employee_role = Role(name="Employee", description="Standard employee access", is_system=1,
                             permissions=[p for p in all_perms if p.name in ("employee:view", "document:view", "document:upload", "leave:view")])
        admin_role = Role(name="Admin", description="System administrator", is_system=1, permissions=all_perms)
        manager_role = Role(name="Manager", description="Department manager access", is_system=1,
                            permissions=[p for p in all_perms if p.name in ("employee:view", "employee:edit", "leave:view", "leave:approve", "document:view", "report:view")])

        db.add_all([hr_manager, employee_role, admin_role, manager_role])
        db.commit()
        print("[Seed] Default roles and permissions created.")
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
app.include_router(approval_router)
app.include_router(template_router)
app.include_router(document_type_router)

@app.get("/")
def root():
    return {
        "message": "HRM Backend Running",
        "status": "OK"
    }