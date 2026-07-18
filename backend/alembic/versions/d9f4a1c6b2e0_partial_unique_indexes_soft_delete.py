"""partial unique indexes for soft-deleted email / username / employee_id

Replaces the full unique indexes on users/employees with PARTIAL unique
indexes scoped to live rows (WHERE is_deleted = false). This lets a new active
record reuse the email / username / employee_id of a soft-deleted one, which
removes the need for the "tombstone rename" workaround in create_employee.

Written idempotently (IF EXISTS / IF NOT EXISTS) so it is safe on databases
whose schema was bootstrapped by Base.metadata.create_all() as well as those
managed purely through migrations.

Revision ID: d9f4a1c6b2e0
Revises: c7a1e5b93d24
Create Date: 2026-07-17
"""
from typing import Sequence, Union

from alembic import op

revision: str = "d9f4a1c6b2e0"
down_revision: Union[str, Sequence[str], None] = "c7a1e5b93d24"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (table, index_name, column)
_PARTIAL_INDEXES = [
    ("users", "ix_users_email_active", "email"),
    ("users", "ix_users_username_active", "username"),
    ("users", "ix_users_employee_id_active", "employee_id"),
    ("employees", "ix_employees_email_active", "email"),
    ("employees", "ix_employees_employee_id_active", "employee_id"),
]

# Old full unique indexes/constraints to remove (raw, guarded).
_DROP_OLD = [
    "DROP INDEX IF EXISTS ix_users_email",
    "DROP INDEX IF EXISTS ix_users_username",
    "ALTER TABLE users DROP CONSTRAINT IF EXISTS users_employee_id_key",
    "DROP INDEX IF EXISTS ix_employees_email",
    "DROP INDEX IF EXISTS ix_employees_employee_id",
]


def upgrade() -> None:
    # 1. Create the partial unique indexes first (uniqueness stays enforced
    #    throughout the transition).
    for table, name, col in _PARTIAL_INDEXES:
        op.execute(
            f"CREATE UNIQUE INDEX IF NOT EXISTS {name} "
            f"ON {table} ({col}) WHERE is_deleted = false"
        )
    # 2. Drop the old full unique indexes / constraints.
    for stmt in _DROP_OLD:
        op.execute(stmt)


def downgrade() -> None:
    # Recreate the old full unique indexes/constraints, then drop the partial ones.
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email)")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username)")
    op.execute("ALTER TABLE users ADD CONSTRAINT users_employee_id_key UNIQUE (employee_id)")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_employees_email ON employees (email)")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_employees_employee_id ON employees (employee_id)")

    for _table, name, _col in _PARTIAL_INDEXES:
        op.execute(f"DROP INDEX IF EXISTS {name}")
