from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database.database import engine
from app.database.base import Base
from app.leave import models as leave_models
from app.employees import models as employee_models  # if exists
from app.auth import models as auth_models  # if exists# ✅ import router
from app.leave.router import router as leave_router
from fastapi.staticfiles import StaticFiles

Base.metadata.create_all(bind=engine)

app = FastAPI(title="HRM Backend")

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads") # new added

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    if engine:
        try:
            # ✅ Create tables
            Base.metadata.create_all(bind=engine)

            # ✅ Connection test
            with engine.connect() as connection:
                pass
            print("✓ Database connected successfully")
        except Exception as e:
            print(f"✗ Database connection failed: {e}")
    else:
        print("⚠ Database engine not initialized")

app.include_router(leave_router)

@app.get("/")
def root():
    return {"message": "HRM backend with DB connected"}

@app.get("/health")
def health():
    return {"status": "ok"}