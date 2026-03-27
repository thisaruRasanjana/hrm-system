from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.database.database import engine
from app.database.base import Base

# Routers
from app.auth.router import router as auth_router
from app.dashboard.router import router as dashboard_router
from app.messages.router import router as messages_router

# Import models so SQLAlchemy registers tables
from app.auth import models
from app.dashboard import models as dashboard_models
from app.messages import models as messages_models


# Create database tables
Base.metadata.create_all(bind=engine)


# Create FastAPI app
app = FastAPI(
    title="HRM System API",
    version="1.0.0"
)


# Enable CORS (Frontend connection)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Register API routers
app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
app.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"])
app.include_router(messages_router, prefix="/messages", tags=["Messages"])


# Root test route
@app.get("/")
def root():
    return {"message": "HRM backend running"}


# Example protected route
security = HTTPBearer()

@app.get("/protected")
def protected_route(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    return {
        "message": "You are authorized",
        "token": credentials.credentials
    }