import imaplib
import email
import socket
import smtplib
import os
from email.header import decode_header
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email import encoders
from sqlalchemy.orm import Session
from app.documents.models.request_model import DocumentRequest, RequestStatus
from dotenv import load_dotenv

load_dotenv()

IMAP_SERVER = os.getenv("IMAP_SERVER", "imap.gmail.com")
IMAP_SERVER = os.getenv("IMAP_SERVER", "imap.gmail.com")
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
IMAP_USER = os.getenv("IMAP_USER", "insharphrmstest@gmail.com")
IMAP_PASSWORD = os.getenv("IMAP_PASSWORD", "dwqyzzeciikdgfpg")
IMAP_TIMEOUT = 15  # seconds


def send_document_to_requester(to_email: str, document_path: str, document_type: str) -> bool:
    """Send the generated document as a PDF attachment to the external requester via Gmail SMTP."""
    try:
        filename = os.path.basename(document_path)

        msg = MIMEMultipart()
        msg["From"] = IMAP_USER
        msg["To"] = to_email
        msg["Subject"] = f"Your Requested Document: {document_type}"

        body = f"""Dear Requester,

Please find attached the document you requested: {document_type}.

This document has been generated and reviewed by our HR team. If you have any questions or require further information, please feel free to reply to this email.

Best regards,
HR Department"""

        msg.attach(MIMEText(body, "plain"))

        # Attach the generated PDF
        with open(document_path, "rb") as f:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(f.read())
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", f'attachment; filename="{filename}"')
            msg.attach(part)

        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(IMAP_USER, IMAP_PASSWORD)
            server.sendmail(IMAP_USER, to_email, msg.as_string())

        print(f"[Email Sender] Successfully sent {filename} to {to_email}")
        return True

    except Exception as e:
        print(f"[Email Sender] Failed to send document to {to_email}: {e}")
        return False

# Keywords to look for in email subject or body (case-insensitive)
REQUEST_KEYWORDS = [
    "document request",
    "letter request",
    "employment verification",
    "employment confirmation",
    "employment letter",
    "salary confirmation",
    "salary letter",
    "service letter",
    "reference letter",
    "work confirmation",
    "bank letter",
    "hr request",
    "official letter",
    "experience letter",
    "certificate request",
    "verification request",
    "request for document",
    "request for letter",
    "request letter",
    "salary slip",
    "payslip",
    "salary statement",
    "pay stub",
    "job confirmation",
]

def _decode_str(s):
    decoded_list = decode_header(s)
    result = ""
    for string, charset in decoded_list:
        if isinstance(string, bytes):
            if charset:
                try:
                    result += string.decode(charset)
                except Exception:
                    result += string.decode("utf-8", errors="ignore")
            else:
                result += string.decode("utf-8", errors="ignore")
        else:
            result += str(string)
    return result

def _is_document_request(subject: str, body: str) -> bool:
    """Return True if subject or body contains known document-request keywords or flexible combinations."""
    combined = (subject + " " + body).lower()
    
    # 1. Direct phrase match (existing behavior)
    if any(kw in combined for kw in REQUEST_KEYWORDS):
        return True
        
    # 2. Flexible match: (request/need/please) AND (document type)
    doc_types = ["letter", "verification", "confirmation", "salary", "slip", "payslip", "employment", "reference", "experience", "document"]
    actions = ["request", "need", "want", "please", "send", "provide"]
    
    has_action = any(a in combined for a in actions)
    has_doc = any(d in combined for d in doc_types)
    
    return has_action and has_doc

def _infer_document_type(subject: str, body: str) -> str:
    """Try to infer the type of document being requested from the email content."""
    combined = (subject + " " + body).lower()
    if "salary" in combined or "payslip" in combined or "slip" in combined:
        return "Salary Confirmation"
    if "service" in combined or "experience" in combined:
        return "Service Letter"
    if "employment" in combined or "work" in combined or "job" in combined:
        return "Employment Confirmation"
    if "bank" in combined:
        return "Bank Letter"
    if "reference" in combined:
        return "Reference Letter"
    # Fall back to subject truncated
    return f"External: {subject[:50]}"

def fetch_and_process_external_requests(db: Session):
    if not IMAP_PASSWORD:
        return {"status": "error", "message": "IMAP_PASSWORD not configured in .env"}

    try:
        socket.setdefaulttimeout(IMAP_TIMEOUT)

        mail = imaplib.IMAP4_SSL(IMAP_SERVER)
        mail.login(IMAP_USER, IMAP_PASSWORD)
        mail.select("inbox")

        # Only fetch UNSEEN (unread) emails - avoids re-processing old ones
        status, messages = mail.search(None, 'UNSEEN')

        if status != "OK":
            return {"status": "error", "message": "Failed to search emails"}

        email_ids = messages[0].split()
        processed_count = 0
        skipped_count = 0

        processed_ids = []
        for e_id in email_ids:
            res, msg_data = mail.fetch(e_id, '(RFC822)')
            for response_part in msg_data:
                if isinstance(response_part, tuple):
                    msg = email.message_from_bytes(response_part[1])
                    subject = _decode_str(msg.get("Subject", ""))
                    from_header = _decode_str(msg.get("From", ""))

                    # Extract raw email from "Name <email@domain.com>"
                    requester_email = from_header
                    if "<" in from_header and ">" in from_header:
                        requester_email = from_header.split("<")[1].split(">")[0]

                    body = ""
                    if msg.is_multipart():
                        for part in msg.walk():
                            if part.get_content_type() == "text/plain":
                                try:
                                    body = part.get_payload(decode=True).decode("utf-8", errors="ignore")
                                    break
                                except Exception:
                                    pass
                    else:
                        try:
                            body = msg.get_payload(decode=True).decode("utf-8", errors="ignore")
                        except Exception:
                            pass

                    # ── KEY FILTER: Only process emails that look like document requests ──
                    if not _is_document_request(subject, body):
                        skipped_count += 1
                        # Mark it as READ so we don't check it again next cycle
                        mail.store(e_id, '+FLAGS', '\\Seen')
                        continue

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
                        requester_email=requester_email
                    )
                    db.add(new_request)
                    processed_ids.append(e_id)
                    processed_count += 1

        if processed_count > 0:
            db.commit()
            # ONLY mark as seen IF database commit was successful
            for e_id in processed_ids:
                mail.store(e_id, '+FLAGS', '\\Seen')
            print(f"[Email Poller] Successfully committed {processed_count} requests to DB.")

        mail.close()
        mail.logout()

        if processed_count > 0 or skipped_count > 0:
            print(f"[Email Poller] Checked {len(email_ids)} unread emails -> {processed_count} requests added, {skipped_count} skipped.")
        
        return {"status": "success", "processed_emails": processed_count, "skipped": skipped_count}

    except Exception as e:
        if db:
            db.rollback()
        print(f"[Email Poller] Error during processing: {e}")
        return {"status": "error", "message": str(e)}
