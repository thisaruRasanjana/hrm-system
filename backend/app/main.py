from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.database import engine
from app.database.base import Base

# Import models so tables are registered
from app.documents.model import EmployeeDocument
from app.documents.router import router as documents_router
from app.documents import request_router


# ✅ FIRST create FastAPI app
app = FastAPI(title="HRM Backend")


# ✅ THEN add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ✅ THEN include routers
app.include_router(documents_router)
app.include_router(request_router.router)


@app.on_event("startup")
def startup():
    # Create tables on startup (development purpose)
    Base.metadata.create_all(bind=engine)


@app.get("/")
def root():
    return {"message": "HRM backend with DB connected"}