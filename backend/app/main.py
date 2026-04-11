from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database.database import engine
from app.database.base import Base
from app.employees.router import router as employee_router

# Create tables (Handled by Alembic in production)
# Base.metadata.create_all(bind=engine)

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