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
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email import encoders
import os
import re

from sqlalchemy.orm import Session

from app.documents.models.request_model import DocumentRequest, RequestStatus
from app.employees.models import Employee
from app.core.config import get_settings


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


# ── Classification Logic ─────────────────────────────────────────────────────

REQUEST_KEYWORDS = {
    "service_letter": ["service letter", "employment letter", "letter of employment", "proof of employment"],
    "payslip": ["payslip", "pay slip", "salary slip", "salary statement"],
    "visa_letter": ["visa letter", "embassy letter", "schengen", "visa application"],
    "general_request": ["request document", "need document", "document request", "issue a letter"]
}

def _is_document_request(subject: str, body: str) -> bool:
    """Determine if an email constitutes a document request based on keywords."""
    text_to_search = (subject + " " + body).lower()
    
    for category, keywords in REQUEST_KEYWORDS.items():
        if any(keyword in text_to_search for keyword in keywords):
            return True
            
    if "request" in text_to_search and any(word in text_to_search for word in ["letter", "certificate", "statement", "document", "slip"]):
        return True
        
    return False


def _infer_document_type(subject: str, body: str) -> str:
    """Guess the requested document type from the email text."""
    text_to_search = (subject + " " + body).lower()
    
    if any(kw in text_to_search for kw in REQUEST_KEYWORDS["service_letter"]):
        return "Service Letter"
    if any(kw in text_to_search for kw in REQUEST_KEYWORDS["payslip"]):
        return "Payslip"
    if any(kw in text_to_search for kw in REQUEST_KEYWORDS["visa_letter"]):
        return "Visa Letter"
        
    return "Custom Document Request"


# ── Main Service Functions ───────────────────────────────────────────────────

def fetch_and_process_external_requests(db: Session) -> int:
    """Connect to IMAP, fetch unread emails, and create DocumentRequests.

    Emails that match request heuristics are added to the database. The emails
    are only marked as \Seen if the database commit succeeds.

    Args:
        db: Active database session.

    Returns:
        Integer count of how many new requests were created.
    """
    settings = get_settings()
    if not settings.imap_user or not settings.imap_password:
        print("[Email Poller] Missing IMAP credentials in config, skipping.")
        return 0

    try:
        mail = imaplib.IMAP4_SSL(settings.imap_server)
        mail.login(settings.imap_user, settings.imap_password)
        mail.select("inbox")

        status, messages = mail.search(None, "UNSEEN")
        if status != "OK" or not messages[0]:
            mail.logout()
            return 0

        email_ids = messages[0].split()
        processed_count = 0
        processed_ids = []

        for e_id in email_ids:
            # BODY.PEEK[] fetches the message WITHOUT setting the \Seen flag, unlike
            # RFC822. This is what lets us leave emails UNSEEN (for retry) if the DB
            # commit below fails — we only mark them \Seen once they're safely persisted.
            res, msg_data = mail.fetch(e_id, "(BODY.PEEK[])")
            if res != "OK":
                continue

            for response_part in msg_data:
                if isinstance(response_part, tuple):
                    msg = email.message_from_bytes(response_part[1])
                    requester_email, subject, body = _parse_email_message(msg)

                    if _is_document_request(subject, body):
                        document_type = _infer_document_type(subject, body)

                        # Auto-link to an existing employee if email matches
                        employee = db.query(Employee).filter(Employee.email == requester_email).first()
                        linked_employee_id = employee.id if employee else None

                        new_request = DocumentRequest(
                            employee_id=linked_employee_id,
                            document_type=document_type,
                            reason=subject if subject else "Document Request",
                            status=RequestStatus.PENDING,
                            source="EXTERNAL",
                            requester_email=requester_email,
                            # Keep the full email body so HR can read the real
                            # context (e.g. which employee the letter is about).
                            requester_message=body.strip() if body else None,
                        )
                        db.add(new_request)
                        processed_count += 1
            
            processed_ids.append(e_id)

        if processed_count > 0:
            try:
                db.commit()
                # Only mark as seen if the commit was successful
                for e_id in processed_ids:
                    mail.store(e_id, '+FLAGS', '\\Seen')
            except Exception as e:
                db.rollback()
                print(f"[Email Poller] Database commit failed, emails left UNSEEN: {e}")
                mail.logout()
                return 0
        else:
            # Mark emails as seen even if they weren't document requests to avoid reprocessing
            for e_id in processed_ids:
                mail.store(e_id, '+FLAGS', '\\Seen')

        mail.logout()
        return processed_count

    except Exception as e:
        print(f"[Email Poller] Error: {e}")
        return 0


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
