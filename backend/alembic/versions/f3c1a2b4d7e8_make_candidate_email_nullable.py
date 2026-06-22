"""make candidate email nullable

Revision ID: f3c1a2b4d7e8
Revises: ba8ad705d455
Create Date: 2026-06-22

The candidates.email column was originally created NOT NULL but the model
intentionally allows NULL — contact fields are populated asynchronously by
the AI screener after the CV is uploaded.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "f3c1a2b4d7e8"
down_revision: Union[str, Sequence[str], None] = "8ead37ed15a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("candidates", "email", existing_type=sa.String(length=254), nullable=True)


def downgrade() -> None:
    op.alter_column("candidates", "email", existing_type=sa.String(length=254), nullable=False)
