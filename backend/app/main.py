from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database.database import engine, SessionLocal
from app.database.base import Base

# Import all models so SQLAlchemy metadata is populated before migration checks
import app.departments.models  # noqa: F401
import app.auth.models         # noqa: F401
import app.roles.models        # noqa: F401
import app.employees.models    # noqa: F401


from app.employees.router import router as employee_router
from app.auth.router import router as auth_router
from app.roles.router import router as roles_router
from app.departments.router import router as departments_router


from app.roles.seed import seed_roles
from app.departments.seed import seed_departments


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run seed functions on startup."""
    db = SessionLocal()
    try:
        seed_departments(db)
        seed_roles(db)
    finally:
        db.close()
    yield


app = FastAPI(title="HRM Backend", lifespan=lifespan)

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
app.include_router(auth_router)
app.include_router(roles_router)
app.include_router(departments_router)