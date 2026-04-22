from sqlalchemy.orm import Session
from datetime import datetime
from uuid import UUID
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.documents.models.model import EmployeeDocument, DocumentStatus
from app.employees.models import Employee

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("IMAP_USER", "sachintharcm@gmail.com")
SMTP_PASSWORD = os.getenv("IMAP_PASSWORD", "ageasapgluchzmwn")


def _send_email(to_email: str, subject: str, body: str):
    """Send a simple plain-text email using existing SMTP creds. Silently fails."""
    try:
        msg = MIMEMultipart()
        msg["From"] = SMTP_USER
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, to_email, msg.as_string())
        print(f"[Email] Sent '{subject}' to {to_email}")
    except Exception as e:
        print(f"[Email] Failed to send to {to_email}: {e}")


# Get all pending documents
def get_pending_documents(db: Session, current_user: Employee):

    from app.auth.models import Role

    role = db.query(Role).filter(Role.id == current_user.role_id).first()
    role_name = role.name.lower() if role else ""

    query = (
        db.query(EmployeeDocument, Employee)
        .outerjoin(Employee, Employee.id == EmployeeDocument.employee_id)
        .filter(EmployeeDocument.status == DocumentStatus.PENDING_REVIEW)
    )

    is_admin = "admin" in role_name
    is_hr = "hr" in role_name

    if is_admin:
        # Super Admin: fetch docs uploaded by users with "HR" role
        hr_roles = db.query(Role).filter(Role.name.ilike("%hr%")).all()
        hr_role_ids = [r.id for r in hr_roles]
        query = query.filter(Employee.role_id.in_(hr_role_ids))
    elif is_hr:
        # HR: see all pending documents (manager_id not yet in Employee model)
        pass  # no extra filter — return all pending
    else:
        # Manager: return all pending docs (manager_id relationship TBD)
        pass  # no extra filter — return all pending

    documents = query.order_by(EmployeeDocument.uploaded_at.desc()).all()

    result = []

    for doc, emp in documents:

        employee_name = "Unknown Employee"

        if emp:
            employee_name = f"{emp.first_name} {emp.last_name}"

        result.append({
            "id": str(doc.id),
            "employee_id": str(doc.employee_id),
            "employee_name": employee_name,
            "document_type": doc.document_type,
            "file_path": doc.file_path,
            "status": doc.status.value,
            "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None
        })

    return result


# Approve document
def approve_document(document_id: UUID, reviewer_id: int, db: Session):

    document = (
        db.query(EmployeeDocument)
        .filter(EmployeeDocument.id == document_id)
        .first()
    )

    if not document:
        return None

    document.status = DocumentStatus.APPROVED
    document.reviewed_by = reviewer_id
    document.reviewed_at = datetime.utcnow()

    db.commit()
    db.refresh(document)

    # Notify the employee by email
    employee = db.query(Employee).filter(Employee.id == document.employee_id).first()
    if employee and employee.email:
        _send_email(
            to_email=employee.email,
            subject=f"Your document '{document.document_type}' has been Approved",
            body=(
                f"Dear {employee.first_name},\n\n"
                f"Your submitted document '{document.document_type}' has been approved by HR.\n\n"
                "Best regards,\nHR Department"
            )
        )

    return document


# Reject document
def reject_document(document_id: UUID, reviewer_id: int, reason: str, db: Session):

    document = (
        db.query(EmployeeDocument)
        .filter(EmployeeDocument.id == document_id)
        .first()
    )

    if not document:
        return None

    document.status = DocumentStatus.REJECTED
    document.reviewed_by = reviewer_id
    document.reviewed_at = datetime.utcnow()
    document.rejection_reason = reason

    db.commit()
    db.refresh(document)

    # Notify the employee by email
    employee = db.query(Employee).filter(Employee.id == document.employee_id).first()
    if employee and employee.email:
        _send_email(
            to_email=employee.email,
            subject=f"Your document '{document.document_type}' has been Rejected",
            body=(
                f"Dear {employee.first_name},\n\n"
                f"Unfortunately, your submitted document '{document.document_type}' has been rejected.\n\n"
                f"Reason: {reason}\n\n"
                "Please re-upload a correct version at your earliest convenience.\n\n"
                "Best regards,\nHR Department"
            )
        )

    return document