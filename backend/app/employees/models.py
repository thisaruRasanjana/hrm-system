from sqlalchemy import Column, String
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.database.base import Base


class Employee(Base):
    __tablename__ = "employees"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)

    email = Column(String, unique=True, nullable=False)

    role = Column(String, nullable=False)  
    # roles: employee / manager / hr / admin