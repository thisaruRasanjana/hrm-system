from fastapi import FastAPI
from app.database.database import engine

app = FastAPI(title="HRM Backend")

@app.on_event("startup")
def startup():
    with engine.connect() as connection:
        pass

@app.get("/")
def root():
    return {"message": "HRM backend with DB connected"}