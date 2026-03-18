from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database.database import engine
from app.database.base import Base
from app.recruitment import models as recruitment_models
from app.recruitment.router import router as recruitment_router
from app.employees.router import router as employees_router

app = FastAPI(title="HRM Backend")

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

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
    try:
        with engine.connect() as connection:
            print("Database connected successfully")
            Base.metadata.create_all(bind=engine)
    except Exception as e:
        print("WARNING: Database connection failed")
        print(e)

app.include_router(recruitment_router)
app.include_router(employees_router)

@app.get("/")
def root():
    return {"message": "HRM backend with DB connected"}