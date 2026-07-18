"""
Document model package.

Importing this package registers every document table on Base.metadata.

This matters for alembic: alembic/env.py discovers models by importing modules
named ``*.models``, which for this package imports only this file. Without the
re-exports below the document tables are absent from the metadata alembic
compares against the database, so ``--autogenerate`` treats the live tables as
orphans and emits DROP TABLE for all of them. Keep this list in sync when
adding a model module.
"""

from app.documents.models.model import EmployeeDocument                # noqa: F401
from app.documents.models.template_model import DocumentTemplate       # noqa: F401
from app.documents.models.document_type_model import DocumentType      # noqa: F401
from app.documents.models.audit_log_model import DocumentAuditLog      # noqa: F401
from app.documents.models.request_model import DocumentRequest         # noqa: F401

__all__ = [
    "EmployeeDocument",
    "DocumentTemplate",
    "DocumentType",
    "DocumentAuditLog",
    "DocumentRequest",
]
