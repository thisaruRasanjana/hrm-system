"""add_soft_delete_and_partial_indexes

Revision ID: ba8ad705d455
Revises: 8e7f6a2a94ac
Create Date: 2026-04-26 11:41:02.515315

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ba8ad705d455'
down_revision: Union[str, Sequence[str], None] = '8e7f6a2a94ac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add is_deleted columns with default False
    op.add_column('users', sa.Column('is_deleted', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('employees', sa.Column('is_deleted', sa.Boolean(), server_default=sa.text('false'), nullable=False))

    # 2. Drop existing unique indexes and constraints
    # For Users
    op.drop_index('ix_users_email', table_name='users')
    op.drop_index('ix_users_username', table_name='users')
    op.drop_constraint('users_employee_id_key', 'users', type_='unique')
    
    # For Employees
    op.drop_index('ix_employees_email', table_name='employees')
    op.drop_index('ix_employees_employee_id', table_name='employees')
    op.drop_constraint('employees_user_id_key', 'employees', type_='unique')

    # 3. Create partial unique indexes (Postgres specific)
    # This allows a new active record to use an email/ID that was used by a deleted record
    op.create_index('ix_users_email_active', 'users', ['email'], unique=True, postgresql_where=sa.text('is_deleted = false'))
    op.create_index('ix_users_username_active', 'users', ['username'], unique=True, postgresql_where=sa.text('is_deleted = false'))
    op.create_index('ix_users_employee_id_active', 'users', ['employee_id'], unique=True, postgresql_where=sa.text('is_deleted = false'))
    
    op.create_index('ix_employees_email_active', 'employees', ['email'], unique=True, postgresql_where=sa.text('is_deleted = false'))
    op.create_index('ix_employees_employee_id_active', 'employees', ['employee_id'], unique=True, postgresql_where=sa.text('is_deleted = false'))
    op.create_index('ix_employees_user_id_active', 'employees', ['user_id'], unique=True, postgresql_where=sa.text('is_deleted = false'))


def downgrade() -> None:
    # 1. Drop partial indexes
    op.drop_index('ix_users_email_active', table_name='users')
    op.drop_index('ix_users_username_active', table_name='users')
    op.drop_index('ix_users_employee_id_active', table_name='users')
    op.drop_index('ix_employees_email_active', table_name='employees')
    op.drop_index('ix_employees_employee_id_active', table_name='employees')
    op.drop_index('ix_employees_user_id_active', table_name='employees')

    # 2. Re-create standard unique indexes and constraints
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    op.create_index('ix_users_username', 'users', ['username'], unique=True)
    op.create_unique_constraint('users_employee_id_key', 'users', ['employee_id'])
    
    op.create_index('ix_employees_email', 'employees', ['email'], unique=True)
    op.create_index('ix_employees_employee_id', 'employees', ['employee_id'], unique=True)
    op.create_unique_constraint('employees_user_id_key', 'employees', ['user_id'])

    # 3. Drop is_deleted columns
    op.drop_column('employees', 'is_deleted')
    op.drop_column('users', 'is_deleted')
