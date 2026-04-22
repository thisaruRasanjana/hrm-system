from sqlalchemy.orm import declarative_base

Base = declarative_base()

# Import all models that use this Base so that
# Base.metadata.create_all() picks them up at startup.
from app.recruitment.models import (  # noqa: E402, F401
    Vacancy, Candidate, Application,
    InterviewPanel, InterviewEvaluation, FinalDecision,
)
from app.employees.models import Employee  # noqa: E402, F401