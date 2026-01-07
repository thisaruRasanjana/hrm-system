from fastapi import FastAPI

from app.database.database import engine
from app.database.base import Base

# IMPORTANT: import models so tables are registered
from app.documents.model import EmployeeDocument
from app.documents.router import router as documents_router
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(title="HRM Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.on_event("startup")
def startup():
    # Create tables on startup (development purpose)
    Base.metadata.create_all(bind=engine)


@app.get("/")
def root():
    return {"message": "HRM backend with DB connected"}


app.include_router(documents_router)
