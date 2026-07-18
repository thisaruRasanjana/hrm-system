"""Add notification archive/trash folders and per-user retention setting

Adds:
  - notifications.is_archived / archived_at  → Archived folder
  - notifications.is_deleted / deleted_at    → Trash folder (restorable)
  - users.notification_retention_days        → auto-purge window (NULL = never)

Revision ID: b4d7e91c3f52
Revises: ea9a30d123f2
Create Date: 2026-07-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b4d7e91c3f52'
down_revision: Union[str, Sequence[str], None] = 'ea9a30d123f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'notifications',
        sa.Column('is_archived', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column('notifications', sa.Column('archived_at', sa.DateTime(), nullable=True))
    op.add_column(
        'notifications',
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column('notifications', sa.Column('deleted_at', sa.DateTime(), nullable=True))

    # The inbox list and the unread badge both filter on
    # (user_id, is_deleted, is_archived) on every poll — index it.
    op.create_index(
        'ix_notifications_user_folder',
        'notifications',
        ['user_id', 'is_deleted', 'is_archived'],
    )
    # The retention purge scans by age.
    op.create_index('ix_notifications_created_at', 'notifications', ['created_at'])

    op.add_column(
        'users',
        sa.Column('notification_retention_days', sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'notification_retention_days')
    op.drop_index('ix_notifications_created_at', table_name='notifications')
    op.drop_index('ix_notifications_user_folder', table_name='notifications')
    op.drop_column('notifications', 'deleted_at')
    op.drop_column('notifications', 'is_deleted')
    op.drop_column('notifications', 'archived_at')
    op.drop_column('notifications', 'is_archived')
