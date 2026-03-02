from sqlalchemy import Column, Integer, String, Text, Date, ForeignKey
from sqlalchemy.orm import relationship
from datetime import date
from app.database.base import Base


class Vacancy(Base):
    __tablename__ = "vacancies"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    department = Column(String(100), nullable=False)
    experience_level = Column(String(50))
    description = Column(Text)
    requirements = Column(Text)
    status = Column(String(50), default="Active")
    created_date = Column(Date, default=date.today)

    applications = relationship("Application", back_populates="vacancy")


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(50))

    applications = relationship("Application", back_populates="candidate")


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    vacancy_id = Column(Integer, ForeignKey("vacancies.id"))
    candidate_id = Column(Integer, ForeignKey("candidates.id"))
    status = Column(String(50))

    vacancy = relationship("Vacancy", back_populates="applications")
    candidate = relationship("Candidate", back_populates="applications")