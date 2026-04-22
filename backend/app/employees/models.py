from sqlalchemy import Column, String, Integer
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.database.base import Base


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)

    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)

    email = Column(String, unique=True, nullable=False)