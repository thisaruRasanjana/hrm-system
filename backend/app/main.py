from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database.database import engine
from app.database.base import Base

# Import models so tables are registered
from app.documents.model import EmployeeDocument

# Routers
from app.documents.router import router as documents_router
from app.documents import request_router
from app.documents.approval_router import router as approval_router


# Create FastAPI app
app = FastAPI(
    title="HRM Backend",
    description="HRMS Document Management API",
    version="1.0.0"
)


# Serve uploaded files (required for document preview)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Change in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include routers
app.include_router(documents_router)
app.include_router(request_router.router)
app.include_router(approval_router)


# Auto create tables (development only)
@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)


# Root endpoint
@app.get("/")
def root():
    return {
        "message": "HRM Backend Running",
        "status": "OK"
    }