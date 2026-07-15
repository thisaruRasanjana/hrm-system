from sqlalchemy import Column, Integer, Float, Date, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy import DateTime
from app.database.base import Base


class EmployeeLeaveAccrualRule(Base):
    """Monthly leave accrual rule for a specific employee and leave type.

    When this rule exists for an employee/type pair, the balance is computed
    dynamically at read-time:
        total_accrued  = elapsed_months × days_per_month
        total_balance  = total_accrued  - total_used_since_period_start
        this_month_bal = days_per_month + carry_from_prev_month - used_this_month

    The accrual is NOT stored month by month — it is derived on the fly, which
    means no cron job is needed and historical accuracy is guaranteed.
    """

    __tablename__ = "employee_leave_accrual_rules"
    __table_args__ = (
        UniqueConstraint("employee_id", "leave_type_id", name="uix_accrual_employee_leave_type"),
    )

    id            = Column(Integer, primary_key=True, index=True)
    employee_id   = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    leave_type_id = Column(Integer, ForeignKey("leave_types.id",  ondelete="CASCADE"), nullable=False)

    # How many leave days the employee earns each calendar month.
    days_per_month = Column(Float, nullable=False)

    # Accrual window — mirrors the designation period.
    period_start = Column(Date, nullable=False)
    period_end   = Column(Date, nullable=True)   # NULL = open-ended

    # Optional cap: maximum days that can accumulate at any point in time.
    # NULL = unlimited carry-forward.
    max_carry_forward = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
