"""add_employee_columns

Revision ID: 8ead37ed15a7
Revises: a02a4429c1fe
Create Date: 2026-05-04 11:46:41.176456

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8ead37ed15a7'
down_revision: Union[str, Sequence[str], None] = 'a02a4429c1fe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    conn.execute(sa.text('ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50)'))
    conn.execute(sa.text('ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone VARCHAR(20)'))
    conn.execute(sa.text('ALTER TABLE employees ADD COLUMN IF NOT EXISTS address TEXT'))
    conn.execute(sa.text('ALTER TABLE employees ADD COLUMN IF NOT EXISTS department_id INTEGER'))
    conn.execute(sa.text('ALTER TABLE employees ADD COLUMN IF NOT EXISTS designation VARCHAR(100)'))
    conn.execute(sa.text('ALTER TABLE employees ADD COLUMN IF NOT EXISTS joined_date DATE'))
    conn.execute(sa.text('ALTER TABLE employees ADD COLUMN IF NOT EXISTS status VARCHAR(50)'))
    conn.execute(sa.text('ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN'))
    conn.execute(sa.text('ALTER TABLE employees ADD COLUMN IF NOT EXISTS date_of_birth DATE'))
    conn.execute(sa.text('ALTER TABLE employees ADD COLUMN IF NOT EXISTS marital_status VARCHAR(20)'))
    conn.execute(sa.text('ALTER TABLE employees ADD COLUMN IF NOT EXISTS nationality VARCHAR(100)'))
    conn.execute(sa.text('ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(100)'))
    conn.execute(sa.text('ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20)'))
    conn.execute(sa.text('ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_relation VARCHAR(50)'))
    conn.execute(sa.text('ALTER TABLE employees ADD COLUMN IF NOT EXISTS skills TEXT'))
    conn.execute(sa.text('ALTER TABLE employees ADD COLUMN IF NOT EXISTS qualifications TEXT'))
    conn.execute(sa.text('ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100)'))
    conn.execute(sa.text('ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_account_no VARCHAR(50)'))
    conn.execute(sa.text('ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(100)'))
    conn.execute(sa.text('ALTER TABLE employees ADD COLUMN IF NOT EXISTS user_id INTEGER'))


def downgrade() -> None:
    """Downgrade schema."""
    pass
