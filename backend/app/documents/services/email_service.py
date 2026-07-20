"""
documents/services/email_service.py
====================================
Service for polling inbound emails and creating EXTERNAL document requests.

Responsibilities:
- Connecting to IMAP server and fetching unread emails.
- Parsing email subjects and bodies.
- Using keyword heuristics to classify emails into DocumentRequests.
- Sending outbound emails (e.g. delivering generated PDFs).
"""

import email
from email.header import decode_header
import imaplib
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email import encoders
from datetime import datetime, timedelta, timezone
from typing import Optional
import os
import re

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.documents.models.document_type_model import DocumentType
from app.documents.models.request_model import DocumentRequest, RequestStatus
from app.employees.models import Employee
from app.core.config import get_settings

logger = logging.getLogger(__name__)

# How far back to look for un-imported requests. The poller no longer trusts the
# IMAP \Seen flag as its import ledger (see source_message_id on DocumentRequest),
# so it re-scans a rolling window and skips anything already in the database.
# 7 days is comfortably longer than any realistic poller outage.
LOOKBACK_DAYS: int = 7

# Messages per IMAP FETCH command. Round-trip latency dominates a poll cycle, so
# batching is what keeps it to seconds rather than minutes on a busy mailbox.
# Bodies are far larger than headers, hence the smaller batch for them.
IMAP_HEADER_BATCH_SIZE: int = 100
IMAP_BODY_BATCH_SIZE: int = 20

# Custom IMAP keyword stamped on every message this poller has examined. This is
# the negative cache that keeps each cycle O(new mail). We deliberately do NOT
# reuse \Seen for this: \Seen is shared with every human who opens the mailbox,
# and relying on it is exactly what caused inbound requests to be dropped.
POLLED_KEYWORD: str = "HrmPolled"

# Bulk FETCHes move real data, so the poller needs a far more generous timeout
# than a simple connectivity check would.
IMAP_TIMEOUT_SECONDS: int = 120


# ── Internal Helpers ─────────────────────────────────────────────────────────

def _decode_str(s) -> str:
    """Decode an email header string into a plain UTF-8 string."""
    if not s:
        return ""
    decoded_list = decode_header(s)
    result = ""
    for text, charset in decoded_list:
        if isinstance(text, bytes):
            try:
                result += text.decode(charset or 'utf-8', errors='replace')
            except LookupError:
                result += text.decode('utf-8', errors='replace')
        else:
            result += str(text)
    return result


def _parse_email_message(msg: email.message.Message) -> tuple[str, str, str]:
    """Parse an email.message.Message to extract sender, subject, and body.

    Args:
        msg: The email message object.

    Returns:
        A tuple of (sender_email, subject, plain_text_body).
    """
    subject = _decode_str(msg.get("Subject", ""))
    from_header = _decode_str(msg.get("From", ""))
    
    # Extract just the email address from formats like "John Doe <john@example.com>"
    sender = from_header
    match = re.search(r'<([^>]+)>', from_header)
    if match:
        sender = match.group(1)

    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition"))

            if content_type == "text/plain" and "attachment" not in content_disposition:
                try:
                    payload = part.get_payload(decode=True)
                    if payload:
                        charset = part.get_content_charset() or 'utf-8'
                        body += payload.decode(charset, errors='replace')
                except Exception:
                    pass
    else:
        try:
            payload = msg.get_payload(decode=True)
            if payload:
                charset = msg.get_content_charset() or 'utf-8'
                body = payload.decode(charset, errors='replace')
        except Exception:
            pass

    return sender, subject, body


def _batch_fetch(mail, ids: list[bytes], what: str, batch_size: int) -> dict[bytes, bytes]:
    """FETCH ``what`` for many messages using as few round trips as possible.

    imaplib will happily take a message set ("1,2,3"), and that matters a lot:
    one FETCH per message against Gmail costs ~0.5s of latency each, which turned
    a 400-message window into a 7-minute poll cycle — longer than the poll
    interval itself. Batching makes the same window a handful of round trips.

    Returns:
        Mapping of IMAP sequence id -> raw bytes for that message.
    """
    out: dict[bytes, bytes] = {}
    for start in range(0, len(ids), batch_size):
        chunk = ids[start:start + batch_size]
        res, data = mail.fetch(b",".join(chunk), what)
        if res != "OK":
            logger.warning(
                "[Email Poller] batch fetch failed for %s message(s) starting at %s",
                len(chunk), chunk[0].decode(),
            )
            continue
        for part in data or []:
            if not isinstance(part, tuple):
                continue
            # Response prefix looks like: b'123 (BODY[...] {456}'
            match = re.match(rb"\s*(\d+)\s+\(", part[0])
            if match:
                out[match.group(1)] = part[1]
    return out


def _mark_polled(mail, ids: list[bytes]) -> None:
    """Tag messages with POLLED_KEYWORD so later cycles skip them.

    Best-effort: the database (source_message_id) is the authority on what has
    been imported, so a failure here can only cost a little redundant work next
    cycle — never a duplicate request.
    """
    if not ids:
        return
    for start in range(0, len(ids), IMAP_HEADER_BATCH_SIZE):
        chunk = ids[start:start + IMAP_HEADER_BATCH_SIZE]
        try:
            mail.store(b",".join(chunk), "+FLAGS", POLLED_KEYWORD)
        except Exception as exc:
            logger.warning(
                "[Email Poller] could not tag %s message(s) as %s (will re-examine "
                "next cycle, no duplicates): %s", len(chunk), POLLED_KEYWORD, exc,
            )


# ── Classification Logic ─────────────────────────────────────────────────────

REQUEST_KEYWORDS = {
    "service_letter": ["service letter", "employment letter", "letter of employment", "proof of employment"],
    "payslip": ["payslip", "pay slip", "salary slip", "salary statement"],
    "visa_letter": ["visa letter", "embassy letter", "schengen", "visa application"],
    "general_request": ["request document", "need document", "document request", "issue a letter"]
}

def _request_type_names(db: Optional[Session]) -> list[str]:
    """Active REQUEST-category document type names, longest first.

    Longest first so a specific name wins over one that is a substring of it
    (e.g. prefer "Employment Confirmation Letter" over "Employment Confirmation").
    """
    if db is None:
        return []
    try:
        names = [
            name for (name,) in db.query(DocumentType.name).filter(
                DocumentType.category == "REQUEST",
                DocumentType.is_active == True,  # noqa: E712 - SQLAlchemy needs ==
            ).all()
        ]
        return sorted(names, key=len, reverse=True)
    except Exception as exc:
        logger.warning("[Email Poller] could not load request document types: %s", exc)
        return []


def _is_document_request(subject: str, body: str, db: Optional[Session] = None) -> bool:
    """Determine if an email constitutes a document request."""
    text_to_search = (subject + " " + body).lower()

    # A configured document type named outright is the strongest possible signal.
    if any(name.lower() in text_to_search for name in _request_type_names(db)):
        return True

    for category, keywords in REQUEST_KEYWORDS.items():
        if any(keyword in text_to_search for keyword in keywords):
            return True

    if "request" in text_to_search and any(word in text_to_search for word in ["letter", "certificate", "statement", "document", "slip"]):
        return True

    return False


def _infer_document_type(subject: str, body: str, db: Optional[Session] = None) -> str:
    """Guess the requested document type from the email text.

    Resolution order matters. The catalogue is checked FIRST because a template
    is matched to a request by ``template.category == document_type``: inventing
    a name that is not a configured document type leaves HR with an empty
    template dropdown and no way to generate the letter. Driving this from the
    DocumentType table also means a type HR adds later is picked up with no code
    change — the previous hard-coded list could only ever emit "Service Letter",
    "Payslip", "Visa Letter" or "Custom Document Request", and three of those
    four were not real document types at all.
    """
    text_to_search = (subject + " " + body).lower()

    # 1. An actual configured document type mentioned by name.
    for name in _request_type_names(db):
        if name.lower() in text_to_search:
            return name

    # 2. Keyword aliases, resolved onto a real document type where one exists so
    #    template matching still works (e.g. "proof of employment" -> whichever
    #    configured type that alias points at).
    catalogue = {name.lower(): name for name in _request_type_names(db)}
    for alias_group, canonical in (
        ("service_letter", "Service Letter"),
        ("payslip", "Payslip"),
        ("visa_letter", "Visa Letter"),
    ):
        if any(kw in text_to_search for kw in REQUEST_KEYWORDS[alias_group]):
            return catalogue.get(canonical.lower(), canonical)

    # 3. Nothing recognised. HR reads requester_message and picks the type by hand.
    return "Custom Document Request"


# ── Main Service Functions ───────────────────────────────────────────────────

def fetch_and_process_external_requests(db: Session) -> int:
    """Connect to IMAP, import inbound document requests, and return how many
    new DocumentRequests were created.

    Import ledger
    -------------
    Whether an email has already been imported is decided by its RFC 5322
    Message-ID against ``DocumentRequest.source_message_id`` — NOT by the IMAP
    \\Seen flag. \\Seen is shared mutable state: a person opening the mailbox in
    any mail client clears it, which previously made inbound requests invisible
    to the poller forever. We therefore re-scan a rolling ``LOOKBACK_DAYS``
    window every cycle and skip anything already in the database, which also
    makes the import naturally idempotent and crash-safe.

    Args:
        db: Active database session.

    Returns:
        Integer count of how many new requests were created.
    """
    settings = get_settings()

    # ── Step 1: credentials & connect ────────────────────────────────────────
    if not settings.imap_user or not settings.imap_password:
        logger.error(
            "[Email Poller] step1: no IMAP credentials configured "
            "(set IMAP_USER/IMAP_PASSWORD, or MAIL_USERNAME/MAIL_PASSWORD). Skipping cycle."
        )
        return 0

    mail = None
    try:
        logger.info(
            "[Email Poller] step1: connecting to %s as %s",
            settings.imap_server, settings.imap_user,
        )
        mail = imaplib.IMAP4_SSL(settings.imap_server, timeout=IMAP_TIMEOUT_SECONDS)
        mail.login(settings.imap_user, settings.imap_password)
        logger.info("[Email Poller] step1: IMAP login OK")
    except Exception as exc:
        # Gmail rejects normal account passwords: IMAP must be enabled and an
        # App Password used. Surface that explicitly instead of dying silently.
        logger.exception(
            "[Email Poller] step1: IMAP connect/login FAILED for %s@%s: %s "
            "(Gmail requires IMAP enabled + a 16-character App Password)",
            settings.imap_user, settings.imap_server, exc,
        )
        return 0

    try:
        # ── Step 2: select mailbox ───────────────────────────────────────────
        status, detail = mail.select("INBOX")
        if status != "OK":
            logger.error("[Email Poller] step2: SELECT INBOX failed: %s %s", status, detail)
            return 0
        logger.info("[Email Poller] step2: INBOX selected, %s message(s) total", detail[0].decode())

        # ── Step 3: search for mail this poller has not examined yet ─────────
        # NOT KEYWORD POLLED_KEYWORD is the negative cache: every message we look
        # at gets tagged, so each cycle only costs what is genuinely new. Crucially
        # this is OUR flag — unlike \Seen, no human clicking around in Gmail can
        # clear it, which is what silently swallowed inbound requests before.
        since = (datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)).strftime("%d-%b-%Y")
        status, messages = mail.search(None, f"SINCE {since} NOT KEYWORD {POLLED_KEYWORD}")
        if status != "OK":
            logger.error("[Email Poller] step3: SEARCH failed: %s", status)
            return 0

        email_ids = messages[0].split() if messages and messages[0] else []
        logger.info(
            "[Email Poller] step3: %s unexamined message(s) in the last %s day(s) (SINCE %s)",
            len(email_ids), LOOKBACK_DAYS, since,
        )
        if not email_ids:
            logger.info("[Email Poller] step3: nothing new to examine this cycle")
            return 0

        # Cheap pass first: pull only Message-ID headers (batched) so already-imported
        # mail is discarded without paying to download full bodies.
        headers = _batch_fetch(
            mail, email_ids,
            "(BODY.PEEK[HEADER.FIELDS (MESSAGE-ID)])",
            IMAP_HEADER_BATCH_SIZE,
        )
        candidates = []          # [(imap_id, message_id)]
        for e_id in email_ids:
            raw = headers.get(e_id)
            if raw is None:
                logger.warning("[Email Poller] step3: no header returned for id=%s", e_id.decode())
                continue
            message_id = _decode_str(
                email.message_from_bytes(raw).get("Message-ID", "")
            ).strip()
            if not message_id:
                # Without a Message-ID we cannot dedupe safely. Skipping is the
                # conservative choice — importing would risk endless duplicates.
                logger.warning(
                    "[Email Poller] step3: id=%s has no Message-ID header, skipping",
                    e_id.decode(),
                )
                continue
            candidates.append((e_id, message_id))

        already = {
            row[0]
            for row in db.query(DocumentRequest.source_message_id)
            .filter(DocumentRequest.source_message_id.in_([m for _, m in candidates]))
            .all()
        } if candidates else set()

        fresh = [(e_id, mid) for e_id, mid in candidates if mid not in already]
        logger.info(
            "[Email Poller] step3: %s candidate(s), %s already imported, %s to inspect",
            len(candidates), len(already), len(fresh),
        )

        # ── Step 4: fetch + classify ─────────────────────────────────────────
        created = 0
        imported_ids = []        # imap ids we successfully turned into requests

        # BODY.PEEK[] fetches messages WITHOUT setting \Seen, unlike RFC822.
        bodies = _batch_fetch(
            mail, [e_id for e_id, _ in fresh], "(BODY.PEEK[])", IMAP_BODY_BATCH_SIZE,
        )
        skipped = 0
        skipped_ids = []         # imap ids examined and rejected as non-requests

        for e_id, message_id in fresh:
            raw = bodies.get(e_id)
            if raw is None:
                logger.warning("[Email Poller] step4: no body returned for id=%s", e_id.decode())
                continue

            msg = email.message_from_bytes(raw)
            requester_email, subject, body = _parse_email_message(msg)

            # Never import our own outbound mail. The letters and rejection notices
            # this system sends ("Your Requested Document: ...", "Regarding Your
            # Document Request: ...") match the request heuristics, so any copy of
            # them reaching this inbox — self-addressed, bounced, or CC'd — would
            # be re-imported as a brand new request, feeding on itself.
            if requester_email.strip().lower() == (settings.imap_user or "").strip().lower():
                skipped += 1
                skipped_ids.append(e_id)
                logger.debug(
                    "[Email Poller] step4: skipped (sent by this system) subject=%r", subject,
                )
                continue

            if not _is_document_request(subject, body, db):
                # Logged at DEBUG: a real inbox is mostly non-requests, and at INFO
                # this drowns out the lines that matter.
                skipped += 1
                skipped_ids.append(e_id)
                logger.debug(
                    "[Email Poller] step4: skipped (not a document request) "
                    "from=%s subject=%r message_id=%s",
                    requester_email, subject, message_id,
                )
                continue

            document_type = _infer_document_type(subject, body, db)

            # Auto-link to an existing employee if the sender address matches
            employee = db.query(Employee).filter(Employee.email == requester_email).first()
            linked_employee_id = employee.id if employee else None
            logger.info(
                "[Email Poller] step4: IMPORTING from=%s subject=%r -> type=%r "
                "linked_employee_id=%s message_id=%s",
                requester_email, subject, document_type, linked_employee_id, message_id,
            )

            # Savepoint per message: if another poller imported this same email
            # between our check above and this insert, the unique index rejects it
            # and we skip just that one instead of losing the whole batch.
            try:
                with db.begin_nested():
                    db.add(DocumentRequest(
                        employee_id=linked_employee_id,
                        document_type=document_type,
                        reason=subject if subject else "Document Request",
                        status=RequestStatus.PENDING,
                        source="EXTERNAL",
                        requester_email=requester_email,
                        # Keep the full email body so HR can read the real
                        # context (e.g. which employee the letter is about).
                        requester_message=body.strip() if body else None,
                        source_message_id=message_id,
                    ))
                created += 1
                imported_ids.append(e_id)
            except IntegrityError:
                logger.info(
                    "[Email Poller] step4: message_id=%s was imported concurrently "
                    "by another poller — skipping (no duplicate created)", message_id,
                )
                skipped_ids.append(e_id)

        logger.info(
            "[Email Poller] step4: %s classified as requests, %s skipped as non-requests",
            created, skipped,
        )

        # ── Step 5: commit ───────────────────────────────────────────────────
        # Non-requests carry no DB state, so they can be tagged examined right away
        # regardless of what the commit does.
        if created == 0:
            logger.info("[Email Poller] step5: nothing new to import this cycle")
            _mark_polled(mail, skipped_ids)
            return 0

        try:
            db.commit()
            logger.info("[Email Poller] step5: commit OK — %s new request(s) created", created)
        except Exception as exc:
            db.rollback()
            # Nothing was persisted, so source_message_id was never written. Leave
            # these messages untagged so the next cycle retries them. No mail is lost.
            logger.exception(
                "[Email Poller] step5: commit FAILED, %s request(s) rolled back "
                "(they will be retried next cycle): %s", created, exc,
            )
            _mark_polled(mail, skipped_ids)
            return 0

        # Tag imported mail as examined. Even if this fails, source_message_id in the
        # database already prevents a re-import, so duplicates are impossible.
        _mark_polled(mail, skipped_ids + imported_ids)

        # \Seen purely as a courtesy for humans reading the mailbox; nothing depends on it.
        for e_id in imported_ids:
            try:
                mail.store(e_id, "+FLAGS", "\\Seen")
            except Exception as exc:
                logger.warning(
                    "[Email Poller] step5: could not set \\Seen on id=%s (harmless): %s",
                    e_id.decode(), exc,
                )

        # ── Notify the eligible managers about external requests ─────────────
        # External requesters are not system users → employee-tier → HR.
        try:
            from app.notifications.service import notify_users
            from app.documents.services.approval_routing import get_eligible_handler_user_ids
            recipients = get_eligible_handler_user_ids(db, None, "document:request_manage")
            notify_users(
                db, recipients,
                f"Received {created} new external document request(s) via email",
                category="document", type="info", link="/dashboard/documents/request_management",
                entity_type="document_request",
            )
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.exception("[Email Poller] notification failed (requests were still imported): %s", exc)

        return created

    except Exception as exc:
        logger.exception("[Email Poller] unexpected error during poll cycle: %s", exc)
        db.rollback()
        return 0
    finally:
        if mail is not None:
            try:
                mail.logout()
            except Exception:
                pass


def send_rejection_to_requester(
    to_email: str, document_type: str, rejection_reason: str
) -> None:
    """Tell an external requester their document request was declined.

    External requesters have no portal account, so the in-app notification that
    internal employees get is invisible to them — email is the only channel back.
    Without this a rejected external request simply went silent, and the sender
    was left waiting indefinitely for a reply that was never coming.

    Args:
        to_email: The external requester's email address.
        document_type: What was requested, echoed so they can identify it.
        rejection_reason: HR's stated reason; included verbatim.

    Raises:
        ValueError: If no recipient address is provided.
        Exception: If SMTP connection/authentication fails.
    """
    settings = get_settings()
    if not settings.imap_user or not settings.imap_password:
        logger.error("[Documents] Missing SMTP credentials, cannot send rejection email.")
        return

    if not to_email:
        raise ValueError("Cannot send rejection: no recipient email address.")

    msg = MIMEMultipart()
    msg["From"] = settings.imap_user
    msg["To"] = to_email
    msg["Subject"] = f"Regarding Your Document Request: {document_type}"

    reason = (rejection_reason or "").strip() or "No reason was provided."
    body = (
        "Hello,\n\n"
        f"Thank you for your request for a {document_type}.\n\n"
        "After review, we are unable to fulfil this request at this time.\n\n"
        f"Reason: {reason}\n\n"
        "If you believe this was in error, or you can provide further details, "
        "please reply to this email.\n\n"
        "Best regards,\nHR Department"
    )
    msg.attach(MIMEText(body, "plain"))

    server = smtplib.SMTP(settings.smtp_server, settings.smtp_port)
    try:
        server.starttls()
        server.login(settings.imap_user, settings.imap_password)
        server.send_message(msg)
    finally:
        server.quit()


def send_document_to_requester(to_email: str, document_path: str, document_type: str) -> None:
    """Send an outbound email delivering a generated document PDF.

    Args:
        to_email: Recipient email address.
        document_path: Absolute path to the PDF to attach.
        document_type: Name of the document (used in subject).

    Raises:
        ValueError: If no recipient address is provided.
        FileNotFoundError: If the document to attach does not exist on disk.
        Exception: If SMTP connection/authentication fails.
    """
    settings = get_settings()
    if not settings.imap_user or not settings.imap_password:
        print("Missing SMTP credentials, cannot send email.")
        return

    if not to_email:
        raise ValueError("Cannot send document: no recipient email address.")

    # Never send a "please find attached" email without the attachment — that just
    # confuses the external requester. Fail loudly so the caller can log and retry.
    if not os.path.exists(document_path):
        raise FileNotFoundError(f"Generated document not found, email not sent: {document_path}")

    msg = MIMEMultipart()
    msg['From'] = settings.imap_user
    msg['To'] = to_email
    msg['Subject'] = f"Your Requested Document: {document_type}"

    body = f"Hello,\n\nPlease find attached your requested document: {document_type}.\n\nBest regards,\nHR Department"
    msg.attach(MIMEText(body, 'plain'))

    filename = os.path.basename(document_path)
    with open(document_path, "rb") as attachment:
        part = MIMEBase('application', 'octet-stream')
        part.set_payload(attachment.read())
        encoders.encode_base64(part)
        part.add_header('Content-Disposition', f"attachment; filename= {filename}")
        msg.attach(part)

    server = smtplib.SMTP(settings.smtp_server, settings.smtp_port)
    server.starttls()
    server.login(settings.imap_user, settings.imap_password)
    server.send_message(msg)
    server.quit()
