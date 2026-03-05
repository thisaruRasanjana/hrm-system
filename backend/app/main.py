from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.database.database import engine
from app.database.base import Base
from app.auth.router import router as auth_router
from app.auth import models

# Create database tables
Base.metadata.create_all(bind=engine)

# Create FastAPI app (ONLY ONCE)
app = FastAPI(
    title="HRM System API",
    version="1.0.0"
)

# ✅ Enable CORS (VERY IMPORTANT)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/auth", tags=["Authentication"])

# Root test route
@app.get("/")
def root():
    return {"message": "HRM backend running"}

# Protected test route
security = HTTPBearer()

@app.get("/protected")
def protected_route(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    return {
        "message": "You are authorized",
        "token": credentials.credentials
    }

