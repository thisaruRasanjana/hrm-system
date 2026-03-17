from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database.database import engine
from app.database.base import Base

# Import models so tables are registered
from app.documents.models.model import EmployeeDocument
from app.documents.models.template_model import DocumentTemplate

# Routers
from app.documents.routers.router import router as documents_router
from app.documents.routers import request_router
from app.documents.routers.approval_router import router as approval_router
from app.documents.routers.template_router import router as template_router


app = FastAPI(
    title="HRM Backend",
    description="HRMS Document Management API",
    version="1.0.0"
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
app.include_router(approval_router)

# Template management router
app.include_router(template_router)


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)


@app.get("/")
def root():
    return {
        "message": "HRM Backend Running",
        "status": "OK"
    }