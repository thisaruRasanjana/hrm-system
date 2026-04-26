"""
Employee Model — SQLAlchemy ORM

Represents a member of staff. Used by the recruitment module to populate
interview panel dropdowns (panel head and panel members).

Column types:
  - String(100): VARCHAR — first/last names have variable length but a
    sensible upper bound; avoids wasted padding of CHAR(N).
  - String(254): Email — RFC 5321 maximum address length.
  - String(20) : Employee number — short fixed-ish code, VARCHAR still
    preferred over CHAR because legacy codes vary in length.
  - CHAR(1)    : gender — single-char code ('M'/'F'/'O') is the one place
    where CHAR is genuinely more appropriate than VARCHAR.
"""

from sqlalchemy import Column, Integer, String, Date, CHAR
from app.database.base import Base


class Employee(Base):
    """
    Core employee record.

    Minimal implementation for the current sprint; additional fields
    (department, role, salary band) will be added in future iterations.
    """

    __tablename__ = "employees"

    id              = Column(Integer,     primary_key=True, index=True)
    first_name      = Column(String(100), nullable=False)
    last_name       = Column(String(100), nullable=False)
    email           = Column(String(254), nullable=True, unique=True)
    employee_number = Column(String(20),  nullable=True, unique=True)
    department      = Column(String(100), nullable=True)
    job_title       = Column(String(150), nullable=True)
    # CHAR(1) is intentional: gender is always exactly one character code.
    gender          = Column(CHAR(1),     nullable=True)
    date_joined     = Column(Date,        nullable=True)
    is_active       = Column(Integer,     nullable=False, default=1)  # 1=active, 0=inactive