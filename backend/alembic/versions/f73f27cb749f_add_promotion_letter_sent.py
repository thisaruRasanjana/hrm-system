"""Add promotion_letter_sent

Revision ID: f73f27cb749f
Revises: 01196226a49c
Create Date: 2026-07-09 22:23:32.333395

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f73f27cb749f'
down_revision: Union[str, Sequence[str], None] = '01196226a49c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('employee_designation_history', sa.Column('promotion_letter_sent', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('employee_designation_history', 'promotion_letter_sent')
