from sqlalchemy.orm import Session
from sqlalchemy import func
from . import models


def create_vacancy(db: Session, vacancy_data):
    vacancy = models.Vacancy(**vacancy_data.dict())
    db.add(vacancy)
    db.commit()
    db.refresh(vacancy)

    return {
        **vacancy.__dict__,
        "applicants": 0
    }


def get_all_vacancies(db: Session):
    vacancies = db.query(models.Vacancy).all()

    result = []
    for v in vacancies:
        applicants_count = (
            db.query(func.count(models.Application.id))
            .filter(models.Application.vacancy_id == v.id)
            .scalar()
        )

        v_dict = {
            **v.__dict__,
            "applicants": applicants_count
        }

        result.append(v_dict)

    return result