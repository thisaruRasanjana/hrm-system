from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import CORS_ORIGINS
from app.database.database import engine
from app.database.base import Base
from app.recruitment.router import router as recruitment_router
from app.recruitment.public_router import router as public_router
from app.employees.router import router as employees_router

app = FastAPI(title="HRM Backend")

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
def startup():
    try:
        with engine.connect() as connection:
            print("Database connected successfully")
            Base.metadata.create_all(bind=engine)
    except Exception as e:
        print("WARNING: Database connection failed")
        print(e)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(recruitment_router)
app.include_router(public_router)
app.include_router(employees_router)

@app.get("/")
def root():
    return {"message": "HRM Backend"}