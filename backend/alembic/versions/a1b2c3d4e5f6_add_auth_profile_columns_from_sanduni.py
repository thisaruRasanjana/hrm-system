"""add_auth_profile_columns_from_sanduni

Revision ID: a1b2c3d4e5f6
Revises: 008823d50b11
Create Date: 2026-04-23 14:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '008823d50b11'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add new user profile, auth and notification columns from Sanduni/authentication branch."""

    # --- users table: new columns ---
    op.add_column('users', sa.Column('refresh_token', sa.String(), nullable=True))
    op.add_column('users', sa.Column('role', sa.String(), nullable=True, server_default='employee'))
    op.add_column('users', sa.Column('position', sa.String(), nullable=True))
    op.add_column('users', sa.Column('role_id', sa.Integer(), sa.ForeignKey('roles.id'), nullable=True))
    op.add_column('users', sa.Column('first_name', sa.String(), nullable=True))
    op.add_column('users', sa.Column('last_name', sa.String(), nullable=True))
    op.add_column('users', sa.Column('employee_id', sa.String(), nullable=True))
    op.add_column('users', sa.Column('department', sa.String(), nullable=True))
    op.add_column('users', sa.Column('phone_number', sa.String(), nullable=True))
    op.add_column('users', sa.Column('address', sa.String(), nullable=True))
    op.add_column('users', sa.Column('date_of_birth', sa.String(), nullable=True))
    op.add_column('users', sa.Column('emergency_contact_number', sa.String(), nullable=True))
    op.add_column('users', sa.Column('profile_image_url', sa.String(), nullable=True))
    op.add_column('users', sa.Column('two_factor_enabled', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('users', sa.Column('totp_secret', sa.String(), nullable=True))
    op.add_column('users', sa.Column('notification_preferences', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('users', sa.Column('quiet_hours_start', sa.String(), nullable=True, server_default="'22:00'"))
    op.add_column('users', sa.Column('quiet_hours_end', sa.String(), nullable=True, server_default="'08:00'"))

    # Make username nullable (Sanduni's branch allows NULL username)
    op.alter_column('users', 'username', nullable=True)

    # Unique constraint on employee_id
    op.create_unique_constraint('uq_users_employee_id', 'users', ['employee_id'])


def downgrade() -> None:
    """Remove the columns added in upgrade."""
    op.drop_constraint('uq_users_employee_id', 'users', type_='unique')
    op.drop_column('users', 'quiet_hours_end')
    op.drop_column('users', 'quiet_hours_start')
    op.drop_column('users', 'notification_preferences')
    op.drop_column('users', 'totp_secret')
    op.drop_column('users', 'two_factor_enabled')
    op.drop_column('users', 'profile_image_url')
    op.drop_column('users', 'emergency_contact_number')
    op.drop_column('users', 'date_of_birth')
    op.drop_column('users', 'address')
    op.drop_column('users', 'phone_number')
    op.drop_column('users', 'department')
    op.drop_column('users', 'employee_id')
    op.drop_column('users', 'last_name')
    op.drop_column('users', 'first_name')
    op.drop_column('users', 'role_id')
    op.drop_column('users', 'position')
    op.drop_column('users', 'role')
    op.drop_column('users', 'refresh_token')
    op.alter_column('users', 'username', nullable=False)
