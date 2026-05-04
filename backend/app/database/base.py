from sqlalchemy.orm import declarative_base

Base = declarative_base()

# Import all models that use this Base so that
# Base.metadata.create_all() picks them up at startup.
import app.recruitment.models  # noqa: E402, F401
import app.employees.models  # noqa: E402, F401