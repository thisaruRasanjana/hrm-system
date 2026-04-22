import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database.database import engine, SessionLocal
from app.database.base import Base

# Import models so tables are registered
from app.documents.models.model import EmployeeDocument
from app.documents.models.template_model import DocumentTemplate
from app.documents.models.document_type_model import DocumentType  # noqa: F401 — registers table

# Routers
from app.documents.routers.router import router as documents_router
from app.documents.routers import request_router
from app.documents.routers.approval_router import router as approval_router
from app.documents.routers.template_router import router as template_router
from app.documents.routers import hr_request_router
from app.documents.routers import hr_own_document_router
from app.documents.routers.document_type_router import router as document_type_router

EMAIL_POLL_INTERVAL = 60  # seconds between each email check

async def email_polling_loop():
    """Runs in the background and polls Gmail inbox every EMAIL_POLL_INTERVAL seconds."""
    # Delay start slightly so FastAPI is fully ready
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    Base.metadata.create_all(bind=engine)
    task = asyncio.create_task(email_polling_loop())
    print("[Email Poller] Background email polling started (every 60 seconds).")
    yield
    # Shutdown
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


app.include_router(documents_router)
app.include_router(request_router.router)
app.include_router(hr_request_router.router)
app.include_router(hr_own_document_router.router)
app.include_router(approval_router)

# Template management router
app.include_router(template_router)

# Document type management
app.include_router(document_type_router)


@app.get("/")
def root():
    return {
        "message": "HRM Backend Running",
        "status": "OK"
    }