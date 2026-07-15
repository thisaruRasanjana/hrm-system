"""add_detailed_accrual_fields

Revision ID: 23a865db923c
Revises: cbd98ed12819
Create Date: 2026-07-15 13:21:13.824425

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '23a865db923c'
down_revision: Union[str, Sequence[str], None] = 'cbd98ed12819'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('employee_leave_accrual_rules', sa.Column('total_leaves_cap', sa.Float(), nullable=True))
    op.add_column('employee_leave_accrual_rules', sa.Column('carry_forward_allowed', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    op.drop_column('employee_leave_accrual_rules', 'carry_forward_allowed')
    op.drop_column('employee_leave_accrual_rules', 'total_leaves_cap')
