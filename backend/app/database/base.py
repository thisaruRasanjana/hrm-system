from sqlalchemy.orm import declarative_base

Base = declarative_base()

# NOTE: Do NOT import models here — that causes circular imports.
# All models are imported in app/main.py before Base.metadata.create_all() is called.