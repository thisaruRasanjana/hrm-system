"""
Recruitment Module — SQLAlchemy ORM Models

Defines the full data model for the recruitment workflow:
  Vacancy → Application → InterviewEvaluation → FinalDecision
  Vacancy → InterviewPanel
  Candidate → Application

Column type rationale:
  - String(N)     : VARCHAR(N) — variable-length text with a known upper bound
  - CHAR(N)       : Fixed-length codes (unused here — all fields are variable)
  - SmallInteger  : 0–32 767 — used for bounded rating scores (1–5 scale) to
                    save storage vs Integer (0–2 billion)
  - Float         : Continuous scores (AI score, overall_score)
  - Text          : Unbounded free-text (descriptions, reasoning, notes)
"""

from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CHAR,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database.base import Base


# ── Vacancy ────────────────────────────────────────────────────────────────────

class Vacancy(Base):
    """
    A job opening posted by HR.

    status lifecycle: Draft → Active → Closed
    Only 'Active' vacancies are visible on the public job portal.
    """

    __tablename__ = "vacancies"

    id               = Column(Integer,     primary_key=True, index=True)
    title            = Column(String(255), nullable=False)
    department       = Column(String(100), nullable=False)
    # experience_level is always one of a short controlled vocabulary,
    # but we keep VARCHAR(50) over CHAR because the lengths differ.
    experience_level = Column(String(50),  nullable=True)
    description      = Column(Text,        nullable=True)
    requirements     = Column(Text,        nullable=True)
    required_skills  = Column(String(500), nullable=True)
    # status is a controlled enum-like field; String(50) is generous but safe.
    status           = Column(String(50),  nullable=False, default="Draft")
    created_date     = Column(Date,        nullable=False, default=date.today)

    # Cascade deletes: removing a vacancy removes all linked applications & panel.
    applications = relationship(
        "Application",
        back_populates="vacancy",
        cascade="all, delete-orphan",
    )
    panel = relationship(
        "InterviewPanel",
        back_populates="vacancy",
        uselist=False,
        cascade="all, delete-orphan",
    )


# ── Candidate ─────────────────────────────────────────────────────────────────

class Candidate(Base):
    """
    A person who has applied (or been uploaded) for one or more vacancies.

    Contact fields are intentionally nullable — the AI screener populates
    them asynchronously after the initial CV upload.
    """

    __tablename__ = "candidates"

    id           = Column(Integer,     primary_key=True, index=True)
    full_name    = Column(String(255), nullable=False)
    # Email can be up to 254 chars per RFC 5321.
    email        = Column(String(254), nullable=True)
    # Phone numbers vary widely in length; 50 chars handles any international format.
    phone        = Column(String(50),  nullable=True)
    cv_file_path = Column(String(500), nullable=False)
    uploaded_at  = Column(DateTime,    nullable=False, default=datetime.utcnow)
    # AI-generated fields — null until the background screener completes.
    ai_score     = Column(Float,       nullable=True)
    ai_reasoning = Column(Text,        nullable=True)

    applications = relationship(
        "Application",
        back_populates="candidate",
        cascade="all, delete-orphan",
    )


# ── Application ───────────────────────────────────────────────────────────────

class Application(Base):
    """
    Links a Candidate to a Vacancy and tracks progression through the pipeline.

    status progression:
      Uploaded → Called → First Round → Second Round Pending →
      Second Round → Job Offered | Rejected
    """

    __tablename__ = "applications"

    id           = Column(Integer,  primary_key=True, index=True)
    vacancy_id   = Column(Integer,  ForeignKey("vacancies.id"),  nullable=False)
    candidate_id = Column(Integer,  ForeignKey("candidates.id"), nullable=False)
    # Default 'Not Called' is kept for backward-compatibility with existing rows.
    status       = Column(String(50), nullable=False, default="Not Called")
    notes        = Column(Text,       nullable=True)
    # Tracks which interview round is currently active. Starts at 1, incremented
    # by trigger_next_round when the panel head decides to proceed.
    active_round = Column(Integer,    nullable=False, default=1)
    created_at   = Column(DateTime,   nullable=False, default=datetime.utcnow)

    vacancy      = relationship("Vacancy",   back_populates="applications")
    candidate    = relationship("Candidate", back_populates="applications")
    evaluations  = relationship(
        "InterviewEvaluation",
        back_populates="application",
        cascade="all, delete-orphan",
    )
    final_decision = relationship(
        "FinalDecision",
        back_populates="application",
        uselist=False,
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        # A candidate can only apply once per vacancy.
        UniqueConstraint("vacancy_id", "candidate_id", name="uix_vacancy_candidate"),
    )


# ── InterviewPanel ────────────────────────────────────────────────────────────

class InterviewPanel(Base):
    """
    Stores the panel head and scheduling link for a vacancy's interview.

    panel_head_id references the users table (must have recruitment:interview_panel
    permission — enforced in service.py, not via FK, to keep the module decoupled).
    Dynamic panel members live in InterviewPanelMember so the count is unlimited.
    """

    __tablename__ = "interview_panels"

    id             = Column(Integer,      primary_key=True, index=True)
    vacancy_id     = Column(Integer,      ForeignKey("vacancies.id"), unique=True, nullable=False)
    panel_head_id  = Column(Integer,      nullable=True)
    # interview_link: Calendly / Google Calendar / any scheduling URL (≤2 048 chars)
    interview_link = Column(String(2048), nullable=True)

    vacancy = relationship("Vacancy", back_populates="panel")
    members = relationship(
        "InterviewPanelMember",
        back_populates="panel",
        cascade="all, delete-orphan",
    )


# ── InterviewPanelMember ──────────────────────────────────────────────────────

class InterviewPanelMember(Base):
    """
    One row per additional panel member (beyond the panel head).
    user_id references the users table; must have recruitment:interview_panel
    permission (validated in service.py).
    """

    __tablename__ = "interview_panel_members"

    id       = Column(Integer,  primary_key=True, index=True)
    panel_id = Column(Integer,  ForeignKey("interview_panels.id"), nullable=False)
    user_id  = Column(Integer,  nullable=False)
    added_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    panel = relationship("InterviewPanel", back_populates="members")

    __table_args__ = (
        # One user can appear at most once per panel.
        UniqueConstraint("panel_id", "user_id", name="uix_panel_member"),
    )



# ── InterviewEvaluation ───────────────────────────────────────────────────────

class InterviewEvaluation(Base):
    """
    One panel member's scorecard for a single interview round.

    Scoring dimensions use SmallInteger (range 1–5) rather than Integer
    because the domain is tightly bounded, saving 2 bytes per column.
    overall_score (0–100 Float) is computed from the five dimensions in
    the service layer and stored for fast sorting/reporting.
    """

    __tablename__ = "interview_evaluations"

    id               = Column(Integer,      primary_key=True, index=True)
    application_id   = Column(Integer,      ForeignKey("applications.id"), nullable=False)
    round_number     = Column(SmallInteger, nullable=False, default=1)

    # Rating dimensions — each scored 1–5 by the evaluator.
    technical_skills = Column(SmallInteger, nullable=False, default=0)
    problem_solving  = Column(SmallInteger, nullable=False, default=0)
    communication    = Column(SmallInteger, nullable=False, default=0)
    cultural_fit     = Column(SmallInteger, nullable=False, default=0)
    attitude         = Column(SmallInteger, nullable=False, default=0)

    # Derived score: (sum_of_5_dims / MAX_TOTAL_SCORE) * 100
    overall_score     = Column(Float,       nullable=False, default=0.0)
    comments          = Column(Text,        nullable=True)
    needs_another_round = Column(Boolean,   nullable=False, default=False)
    # Evaluator stored as text (display) and as user FK (dedup + role mapping).
    evaluator_name    = Column(String(255), nullable=True)
    evaluator_user_id = Column(Integer,     nullable=True)   # references users.id
    created_at        = Column(DateTime,    nullable=False, default=datetime.utcnow)

    application = relationship("Application", back_populates="evaluations")


# ── FinalDecision ─────────────────────────────────────────────────────────────

class FinalDecision(Base):
    """
    The panel head's conclusive verdict on a candidate after all rounds.

    decision values: 'Proceed to Next Round' | 'Job Offered' | 'Rejected'
    These mirror the constants defined in recruitment/service.py.
    """

    __tablename__ = "final_decisions"

    id             = Column(Integer,    primary_key=True, index=True)
    application_id = Column(Integer,    ForeignKey("applications.id"), unique=True, nullable=False)
    # String(50) is sufficient for all three controlled decision values.
    decision       = Column(String(50), nullable=False)
    notes          = Column(Text,       nullable=True)
    decided_at     = Column(DateTime,   nullable=False, default=datetime.utcnow)

    application = relationship("Application", back_populates="final_decision")