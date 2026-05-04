"""add_is_superadmin

Revision ID: a02a4429c1fe
Revises: ba8ad705d455
Create Date: 2026-05-04 11:40:46.114273

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a02a4429c1fe'
down_revision: Union[str, Sequence[str], None] = 'ba8ad705d455'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('is_superadmin', sa.Boolean(), server_default='false', nullable=True))
    op.add_column('users', sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'is_deleted')
    op.drop_column('users', 'is_superadmin')
