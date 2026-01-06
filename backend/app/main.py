from fastapi import FastAPI
from app.database.database import engine
from app.database.base import Base
from app.recruitment import models as recruitment_models
from app.recruitment.router import router as recruitment_router

app = FastAPI(title="HRM Backend")

@app.on_event("startup")
def startup():
    with engine.connect() as connection:
        pass
    Base.metadata.create_all(bind=engine)

app.include_router(recruitment_router)

@app.get("/")
def root():
    return {"message": "HRM backend with DB connected"}