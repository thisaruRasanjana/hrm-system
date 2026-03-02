from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.deps import get_db
from . import schemas, service

router = APIRouter(prefix="/recruitment", tags=["Recruitment"])


@router.post("/vacancies", response_model=schemas.VacancyResponse)
def create_vacancy(vacancy: schemas.VacancyCreate, db: Session = Depends(get_db)):
    return service.create_vacancy(db, vacancy)


@router.get("/vacancies", response_model=list[schemas.VacancyResponse])
def list_vacancies(db: Session = Depends(get_db)):
    return service.get_all_vacancies(db)