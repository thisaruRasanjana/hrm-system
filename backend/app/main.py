from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database.database import engine

app = FastAPI(title="HRM Backend")

# Add CORS middleware to allow frontend to access the backend
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
            with engine.connect() as connection:
                pass
            print("✓ Database connected successfully")
        except Exception as e:
            print(f"✗ Database connection failed: {e}")
    else:
        print("⚠ Database engine not initialized")

@app.get("/")
def root():
    return {"message": "HRM backend with DB connected"}

@app.get("/health")
def health():
    return {"status": "ok"}