"""merge notification folders with prorated leaves

Revision ID: 6efa3152e122
Revises: 6979a8f61482, b4d7e91c3f52
Create Date: 2026-07-16 21:30:38.162531

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6efa3152e122'
down_revision: Union[str, Sequence[str], None] = ('6979a8f61482', 'b4d7e91c3f52')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
