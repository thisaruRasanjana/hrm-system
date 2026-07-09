"""make designation nullable

Revision ID: 01196226a49c
Revises: a82f12e7086f
Create Date: 2026-07-09 14:45:32.801620

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '01196226a49c'
down_revision: Union[str, Sequence[str], None] = 'a82f12e7086f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('employees', 'phone',
               existing_type=sa.VARCHAR(length=20),
               nullable=True)
    op.alter_column('employees', 'designation',
               existing_type=sa.VARCHAR(length=100),
               nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('employees', 'designation',
               existing_type=sa.VARCHAR(length=100),
               nullable=False)
    op.alter_column('employees', 'phone',
               existing_type=sa.VARCHAR(length=20),
               nullable=False)
