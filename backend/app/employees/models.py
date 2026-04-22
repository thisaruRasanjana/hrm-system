from sqlalchemy import Column, Integer, String
from app.database.base import Base


class Employee(Base):
    """Employee profile — minimal stub, full implementation in future sprint."""
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)