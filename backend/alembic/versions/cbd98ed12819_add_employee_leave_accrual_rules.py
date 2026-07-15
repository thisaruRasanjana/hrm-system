"""add_employee_leave_accrual_rules

Revision ID: cbd98ed12819
Revises: f73f27cb749f
Create Date: 2026-07-14 14:57:14.347199

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'cbd98ed12819'
down_revision: Union[str, Sequence[str], None] = 'f73f27cb749f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add employee_leave_accrual_rules table for monthly accrual feature."""
    op.create_table(
        'employee_leave_accrual_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('employee_id', sa.Integer(), nullable=False),
        sa.Column('leave_type_id', sa.Integer(), nullable=False),
        sa.Column('days_per_month', sa.Float(), nullable=False),
        sa.Column('period_start', sa.Date(), nullable=False),
        sa.Column('period_end', sa.Date(), nullable=True),
        sa.Column('max_carry_forward', sa.Float(), nullable=True),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['leave_type_id'], ['leave_types.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('employee_id', 'leave_type_id', name='uix_accrual_employee_leave_type'),
    )
    op.create_index(op.f('ix_employee_leave_accrual_rules_id'), 'employee_leave_accrual_rules', ['id'], unique=False)


def downgrade() -> None:
    """Remove employee_leave_accrual_rules table."""
    op.drop_index(op.f('ix_employee_leave_accrual_rules_id'), table_name='employee_leave_accrual_rules')
    op.drop_table('employee_leave_accrual_rules')
