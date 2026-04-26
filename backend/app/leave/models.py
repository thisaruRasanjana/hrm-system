"""
app/leave/models.py
-------------------
SQLAlchemy ORM models for the leave management module.

Column type rationale:
  - status uses String(20): only ever one of four short codes (PENDING, APPROVED,
    REJECTED, REQ_INFO). CHAR(20) would waste space on variable-length values;
    VARCHAR(20) is correct.
  - total_days uses Float to support half-day (0.5) values.
  - attachment_urls uses JSON to store an ordered list of URL strings without
    requiring a separate junction table.
  - reason / rejection_reason / manager_comment use Text because their length
    is unbounded.
"""

from sqlalchemy import (
    Column, Integer, String, Date, Float, Text,
    DateTime, Boolean, ForeignKey, JSON,
)
from sqlalchemy.sql import func
from app.database.base import Base


class LeaveType(Base):
    """Catalogue of leave categories available in the system."""

    __tablename__ = "leave_types"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String(50), nullable=False, unique=True)
    description = Column(String(255), nullable=True)


class LeaveRequest(Base):
    """A single leave application submitted by an employee."""

    __tablename__ = "leave_requests"

    leave_request_id = Column(Integer, primary_key=True, index=True)

    # Employee who submitted the request.
    employee_id  = Column(Integer, nullable=False, index=True)
    leave_type_id = Column(Integer, ForeignKey("leave_types.id"), nullable=False)

    # HR/manager who acted on the request (NULL while still PENDING).
    approved_by  = Column(Integer, nullable=True)

    start_date   = Column(Date, nullable=False)
    end_date     = Column(Date, nullable=False)

    # Float to accommodate 0.5 for half-day requests.
    total_days   = Column(Float, nullable=False)
    half_day     = Column(Boolean, default=False, nullable=False)

    # VARCHAR(20) — max status string is "REQ_INFO" (8 chars); 20 gives headroom.
    status       = Column(String(20), default="PENDING", nullable=False)

    # Unbounded text fields.
    reason            = Column(Text, nullable=True)
    rejection_reason  = Column(Text, nullable=True)
    manager_comment   = Column(Text, nullable=True)

    # JSON list of uploaded file URL strings.
    attachment_urls   = Column(JSON, nullable=True)

    approved_date = Column(Date, nullable=True)

    # Audit timestamps — set automatically by the database.
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )