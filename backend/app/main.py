from fastapi import FastAPI
from fastapi.security import HTTPBearer
from app.database.database import engine
from app.database.base import Base
from app.auth import models
from app.auth.router import router as auth_router

app = FastAPI(
    title="HRM System API",
    version="1.0.0"
)

# 👇 This enables the Authorize button
security = HTTPBearer()

Base.metadata.create_all(bind=engine)

app.include_router(auth_router, prefix="/auth", tags=["Authentication"])

@app.get("/")
def root():
    return {"message": "HRM backend running"}

from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

@app.get("/protected")
def protected_route(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    return {
        "message": "You are authorized",
        "token": credentials.credentials
    }

from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

@app.get("/protected")
def protected_route(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    return {
        "message": "You are authorized",
        "token": credentials.credentials
    }
