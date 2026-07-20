"""add source_message_id to document_requests

Gives the email poller a durable "already imported" ledger keyed on the inbound
email's RFC 5322 Message-ID. Previously the poller relied solely on the IMAP
\\Seen flag, which any human opening the mailbox clears — silently dropping
inbound external document requests.

Revision ID: f3b8c2d47a91
Revises: d9f4a1c6b2e0
Create Date: 2026-07-20

"""
from alembic import op
import sqlalchemy as sa


revision = "f3b8c2d47a91"
down_revision = "d9f4a1c6b2e0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "document_requests",
        sa.Column("source_message_id", sa.String(length=255), nullable=True),
    )
    # UNIQUE, not just indexed: the poller's "have I imported this?" check is a
    # read followed by a write, so two pollers racing (e.g. a scheduled cycle and
    # a manual /poll-inbox trigger) can both read "no" and both insert. Only the
    # database can settle that. Partial, because INTERNAL requests have no
    # Message-ID and NULLs must not collide.
    op.create_index(
        "ix_document_requests_source_message_id",
        "document_requests",
        ["source_message_id"],
        unique=True,
        postgresql_where=sa.text("source_message_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_document_requests_source_message_id",
        table_name="document_requests",
    )
    op.drop_column("document_requests", "source_message_id")
