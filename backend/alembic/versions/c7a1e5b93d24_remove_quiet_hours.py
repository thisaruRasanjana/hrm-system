"""Remove quiet hours

Drops users.quiet_hours_start / quiet_hours_end.

The feature was never wired up — the columns were written by the settings page
but no notification path ever read them. It was removed rather than finished:
with in-app notifications there is no push or sound to silence, so "muting"
could only mean withholding notifications, which risks a user never seeing a
leave approval or document decision raised during their window.

Revision ID: c7a1e5b93d24
Revises: 6efa3152e122
Create Date: 2026-07-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7a1e5b93d24'
down_revision: Union[str, Sequence[str], None] = '6efa3152e122'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # IF EXISTS so this is safe on databases where the columns were never
    # created (they predate alembic tracking on some machines).
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS quiet_hours_start")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS quiet_hours_end")


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column(
        'users',
        sa.Column('quiet_hours_start', sa.String(), nullable=True, server_default='22:00'),
    )
    op.add_column(
        'users',
        sa.Column('quiet_hours_end', sa.String(), nullable=True, server_default='08:00'),
    )
