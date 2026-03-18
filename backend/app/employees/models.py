from sqlalchemy import Column, Integer, String
from app.database.database import engine
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)

# create table if it doesn't exist
Base.metadata.create_all(bind=engine)