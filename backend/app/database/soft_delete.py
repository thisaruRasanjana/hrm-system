"""
database/soft_delete.py
=======================
Centralized soft-delete filtering for the ORM.

Instead of every query remembering ``WHERE is_deleted = false`` (and leaking
deleted rows whenever someone forgets — as happened in the document approval
queue), this module installs a single global filter. Any mapped class that
inherits :class:`SoftDeleteMixin` is automatically filtered on every SELECT.

Opting out
----------
When you genuinely need to see soft-deleted rows (admin tooling, re-creation
flows, purge jobs), pass the ``include_deleted`` execution option::

    db.query(User).filter(User.email == email) \
        .execution_options(include_deleted=True).first()

Design notes
------------
- The filter is applied via ``with_loader_criteria`` on the mixin, so it also
  covers JOINs and eager (joined/subquery) loads of the affected entities.
- Lazy relationship loads and deferred column loads are intentionally left
  untouched (the standard SQLAlchemy recipe) to avoid surprising reloads.
- Only classes that extend ``SoftDeleteMixin`` are affected. Models with their
  own unrelated ``is_deleted`` semantics (notifications trash, message
  recipients) are deliberately NOT mixed in and keep their explicit filters.
"""

from sqlalchemy import Boolean, event
from sqlalchemy.orm import Session, mapped_column, with_loader_criteria


class SoftDeleteMixin:
    """Base for entities carrying an ``is_deleted`` soft-delete flag.

    The column is declared here so a single :func:`with_loader_criteria` target
    covers every soft-deletable model. Inheriting this class is what opts a
    model into the global filter installed by
    :func:`install_soft_delete_filter`; models must NOT re-declare
    ``is_deleted`` themselves.
    """

    # Nullable with a Python-side default, matching the pre-existing schema
    # (the column was originally created without a server default).
    is_deleted = mapped_column(Boolean, default=False)


def install_soft_delete_filter() -> None:
    """Register the global ``do_orm_execute`` listener. Idempotent."""

    if getattr(install_soft_delete_filter, "_installed", False):
        return

    @event.listens_for(Session, "do_orm_execute")
    def _add_soft_delete_criteria(execute_state):  # noqa: ANN001
        if (
            execute_state.is_select
            and not execute_state.is_column_load
            and not execute_state.is_relationship_load
            and not execute_state.execution_options.get("include_deleted", False)
        ):
            execute_state.statement = execute_state.statement.options(
                with_loader_criteria(
                    SoftDeleteMixin,
                    lambda cls: (cls.is_deleted == False) | (cls.is_deleted.is_(None)),  # noqa: E712
                    include_aliases=True,
                )
            )

    install_soft_delete_filter._installed = True
