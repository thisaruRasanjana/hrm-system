"""Add purpose column to document_requests

Revision ID: 088724ed99c2
Revises: a1b2c3d4e5f6
Create Date: 2026-04-25 17:24:17.785581

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '088724ed99c2'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('document_requests', sa.Column('purpose', sa.String(), nullable=True))

def downgrade() -> None:
    op.drop_column('document_requests', 'purpose')
