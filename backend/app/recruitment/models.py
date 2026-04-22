from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey, Float, Boolean
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
    required_skills = Column(String(500))
    status = Column(String(50), default="Draft")
    created_date = Column(Date, default=date.today)

    applications = relationship("Application", back_populates="vacancy", cascade="all, delete-orphan")
    panel = relationship("InterviewPanel", back_populates="vacancy", uselist=False, cascade="all, delete-orphan")

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
    ai_reasoning = Column(Text, nullable=True)

    applications = relationship("Application", back_populates="candidate", cascade="all, delete-orphan")

from sqlalchemy import UniqueConstraint

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
    evaluations = relationship("InterviewEvaluation", back_populates="application", cascade="all, delete-orphan")
    final_decision = relationship("FinalDecision", back_populates="application", uselist=False, cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint('vacancy_id', 'candidate_id', name='uix_vacancy_candidate'),
    )

class InterviewPanel(Base):
    __tablename__ = "interview_panels"

    id = Column(Integer, primary_key=True, index=True)

    vacancy_id = Column(Integer, ForeignKey("vacancies.id"), unique=True)

    panel_head_id = Column(Integer)
    panel_member_1_id = Column(Integer)
    panel_member_2_id = Column(Integer)

    interview_link = Column(String, nullable=True)

    vacancy = relationship("Vacancy", back_populates="panel")


class InterviewEvaluation(Base):
    __tablename__ = "interview_evaluations"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False)
    
    round_number = Column(Integer, default=1)
    
    technical_skills = Column(Integer, default=0)
    problem_solving = Column(Integer, default=0)
    communication = Column(Integer, default=0)
    cultural_fit = Column(Integer, default=0)
    attitude = Column(Integer, default=0)
    
    overall_score = Column(Float, default=0.0)
    comments = Column(Text, nullable=True)
    needs_another_round = Column(Boolean, default=False)
    evaluator_name = Column(String(255), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    application = relationship("Application", back_populates="evaluations")


class FinalDecision(Base):
    __tablename__ = "final_decisions"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), unique=True, nullable=False)
    decision = Column(String(50), nullable=False)  # Selected | Rejected | Keep for Future
    notes = Column(Text, nullable=True)
    decided_at = Column(DateTime, default=datetime.utcnow)

    application = relationship("Application", back_populates="final_decision")