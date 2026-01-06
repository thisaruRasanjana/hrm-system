from sqlalchemy.orm import Session
from . import models, schemas

def create_vacancy(db: Session, vacancy: schemas.VacancyCreate):
    db_vacancy = models.Vacancy(**vacancy.dict())
    db.add(db_vacancy)
    db.commit()
    db.refresh(db_vacancy)
    return db_vacancy

def get_all_vacancies(db: Session):
    return db.query(models.Vacancy).all()