from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey, Float
from datetime import date, datetime
from sqlalchemy.orm import relationship
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
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)

    # NEW FIELDS
    cv_file_path = Column(String(500), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    ai_score = Column(Float, nullable=True)

    applications = relationship("Application", back_populates="candidate")


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    vacancy_id = Column(Integer, ForeignKey("vacancies.id"), nullable=False)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)

    status = Column(String(50), default="Not Called")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    vacancy = relationship("Vacancy", back_populates="applications")
    candidate = relationship("Candidate", back_populates="applications")


class InterviewPanel(Base):
    __tablename__ = "interview_panels"

    id = Column(Integer, primary_key=True, index=True)

    vacancy_id = Column(Integer, ForeignKey("vacancies.id"), unique=True)

    panel_head_id = Column(Integer)
    panel_member_1_id = Column(Integer)
    panel_member_2_id = Column(Integer)

    interview_link = Column(String, nullable=True)

    vacancy = relationship("Vacancy")