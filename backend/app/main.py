from fastapi import FastAPI

from app.database.database import engine
from app.database.base import Base

# IMPORTANT: import models so tables are registered
from app.documents.model import EmployeeDocument
from app.documents.router import router as documents_router


app = FastAPI(title="HRM Backend")


@app.on_event("startup")
def startup():
    # Create tables on startup (development purpose)
    Base.metadata.create_all(bind=engine)


@app.get("/")
def root():
    return {"message": "HRM backend with DB connected"}


app.include_router(documents_router)
