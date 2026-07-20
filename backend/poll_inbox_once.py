"""
poll_inbox_once.py
==================
Run ONE inbound-email poll cycle from the command line, with full debug logging.

For QA of the external document-request flow: send a test email to the company
inbox, then run this instead of waiting for the scheduled poll interval.

    cd backend
    venv\\Scripts\\python.exe poll_inbox_once.py

Import is deduped on the email's RFC 5322 Message-ID, so running this repeatedly
is safe — an email that has already been imported is skipped, not duplicated.
"""

import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    stream=sys.stdout,
)
# The poll cycle's own step-by-step logging lives on this logger.
logging.getLogger("app.documents.services.email_service").setLevel(logging.INFO)

from app.database.database import SessionLocal                      # noqa: E402
from app.documents.models.request_model import DocumentRequest      # noqa: E402
from app.documents.services import email_service                    # noqa: E402


def main() -> int:
    db = SessionLocal()
    try:
        before = db.query(DocumentRequest).filter(
            DocumentRequest.source == "EXTERNAL"
        ).count()
        print(f"\nEXTERNAL requests before : {before}")
        print("--- running one poll cycle ---")

        created = email_service.fetch_and_process_external_requests(db)

        after = db.query(DocumentRequest).filter(
            DocumentRequest.source == "EXTERNAL"
        ).count()
        print("--- cycle complete ---")
        print(f"EXTERNAL requests after  : {after}  (created {created})")

        if created:
            print("\nNewly imported:")
            for r in (
                db.query(DocumentRequest)
                .filter(DocumentRequest.source == "EXTERNAL")
                .order_by(DocumentRequest.created_at.desc())
                .limit(created)
            ):
                print(f"  {r.document_type!r} from {r.requester_email} "
                      f"(employee_id={r.employee_id}, status={r.status.value})")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
