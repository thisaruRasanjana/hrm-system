"""drop leftover FULL unique constraints on email / username / employee_id

BUG-02 / BUG-14: a soft-deleted employee's email (or username) could not be
reused, and a new record could not be created, because a *full* unique
constraint still constrained every row — including tombstoned ones.

Migration d9f4a1c6b2e0 already replaced the full unique *indexes*
(ix_users_email, ...) with partial ones scoped to live rows. But a database
that was ever bootstrapped via ``Base.metadata.create_all()`` with older models
(where the columns were declared ``unique=True``) can still carry Postgres'
auto-named unique *constraints* (``users_email_key``, ``employees_email_key``,
...), which that migration did not drop. Those leftover constraints are exactly
what re-blocks reuse.

This migration drops any such lingering full constraints idempotently and
re-asserts the partial unique indexes, so uniqueness among *live* rows stays
enforced while soft-deleted rows never block reuse. It is a safe no-op on a
database already on the partial-index scheme.

Revision ID: e1f2a3b4c5d6
Revises: f3b8c2d47a91
Create Date: 2026-07-21
"""
from typing import Sequence, Union

from alembic import op

revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, Sequence[str], None] = "f3b8c2d47a91"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Auto-named full unique constraints Postgres would create for `unique=True`
# columns. Dropping the constraint also drops its backing index.
_DROP_CONSTRAINTS = [
    "ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key",
    "ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key",
    "ALTER TABLE users DROP CONSTRAINT IF EXISTS users_employee_id_key",
    "ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_email_key",
    "ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_employee_id_key",
]

# Also clear any remaining full unique *indexes* (belt and braces).
_DROP_INDEXES = [
    "DROP INDEX IF EXISTS ix_users_email",
    "DROP INDEX IF EXISTS ix_users_username",
    "DROP INDEX IF EXISTS ix_employees_email",
    "DROP INDEX IF EXISTS ix_employees_employee_id",
]

# (table, index_name, column) — the partial indexes that MUST remain in place.
_PARTIAL_INDEXES = [
    ("users", "ix_users_email_active", "email"),
    ("users", "ix_users_username_active", "username"),
    ("users", "ix_users_employee_id_active", "employee_id"),
    ("employees", "ix_employees_email_active", "email"),
    ("employees", "ix_employees_employee_id_active", "employee_id"),
]


def upgrade() -> None:
    # Ensure the live-row uniqueness guarantee is in place BEFORE removing the
    # old full constraints, so there is never a window without enforcement.
    for table, name, col in _PARTIAL_INDEXES:
        op.execute(
            f"CREATE UNIQUE INDEX IF NOT EXISTS {name} "
            f"ON {table} ({col}) WHERE is_deleted = false"
        )
    for stmt in _DROP_CONSTRAINTS:
        op.execute(stmt)
    for stmt in _DROP_INDEXES:
        op.execute(stmt)


def downgrade() -> None:
    # These constraints were leftovers we deliberately removed; recreating them
    # would reintroduce the bug, so downgrade is intentionally a no-op.
    pass
