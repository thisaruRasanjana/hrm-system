import os
import smtplib
import logging
from email.mime.text import MIMEText
from dotenv import load_dotenv
from pathlib import Path

logger = logging.getLogger(__name__)

_env_path = Path(__file__).parent.parent.parent / ".env"


def _send(to_email: str, subject: str, body: str, html: bool = False):
    """Internal SMTP send helper. Reloads .env on every call so credential changes
    in .env take effect without restarting the server."""
    load_dotenv(dotenv_path=_env_path, override=True)

    smtp_server = os.getenv("MAIL_SERVER")
    smtp_port = int(os.getenv("MAIL_PORT", "587"))
    smtp_user = os.getenv("MAIL_USERNAME")
    smtp_password = (os.getenv("MAIL_PASSWORD") or "").replace(" ", "")
    mail_from = os.getenv("MAIL_FROM")

    if not all([smtp_server, smtp_user, smtp_password, mail_from]):
        print(f"[EMAIL SKIPPED] {subject} → {to_email} (mail config not set)")
        return

    try:
        mime_type = "html" if html else "plain"
        msg = MIMEText(body, mime_type)
        msg["Subject"] = subject
        msg["From"] = mail_from
        msg["To"] = to_email

        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_server, smtp_port, timeout=5) as server:
                server.login(smtp_user, smtp_password)
                server.sendmail(mail_from, to_email, msg.as_string())
        else:
            with smtplib.SMTP(smtp_server, smtp_port, timeout=5) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.sendmail(mail_from, to_email, msg.as_string())
        logger.info(f"Email sent: '{subject}' → {to_email}")
    except Exception as e:
        logger.error(f"[ERROR] Failed to send email: {e}")
        raise RuntimeError(f"Failed to send email: {str(e)}") from e


def send_otp_email(to_email: str, otp: str):
    _send(to_email, "HRM Password Reset OTP", f"Your OTP for password reset is: {otp}")


# ── Notification emails ────────────────────────────────────────────────────────

# Shown as the email subject prefix so notification mail is filterable.
_CATEGORY_SUBJECTS = {
    "leave": "Leave Update",
    "attendance": "Attendance Reminder",
    "recruitment": "Recruitment Update",
    "announcement": "Company Announcement",
    "events": "Event Update",
    "holiday": "Holiday Reminder",
    "celebration": "Celebration",
    "document": "Document Update",
    "system": "System Update",
    "security": "Security Alert",
}


def send_notification_email(
    to_email: str,
    message: str,
    category: str | None = None,
    link: str | None = None,
    dashboard_url: str | None = None,
) -> None:
    """
    Email the text of an in-app notification.

    Delivery is decided by the caller (app.notifications.service), which applies
    the user's per-category email preference and quiet hours. This function only
    renders and sends. Raises on SMTP failure — the caller runs it off-request
    and swallows errors so a mail outage can never fail the triggering action.
    """
    label = _CATEGORY_SUBJECTS.get(category or "", "Notification")

    base = (dashboard_url or os.getenv("DASHBOARD_URL") or "http://localhost:3000").rstrip("/")
    button = ""
    if link:
        url = link if link.startswith("http") else f"{base}{link}"
        button = f"""
      <p style="margin: 24px 0;">
        <a href="{url}" style="background: #f08a4b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          View in HRMS
        </a>
      </p>"""

    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px;">
      <h2 style="color: #f08a4b; margin-bottom: 4px;">{label}</h2>
      <p style="font-size: 15px; color: #111827;">{message}</p>{button}
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">
        You are receiving this because email is enabled for {label.lower()} notifications.
        Change this in HRMS under Settings → Notifications.
      </p>
    </div>
    """
    _send(to_email, f"[HRMS] {label}", html_body, html=True)


# ── Recruitment email functions ────────────────────────────────────────────────

async def send_scheduling_email(to: str, candidate_name: str, job_title: str, interview_link: str) -> None:
    """Sends an interview scheduling link to a candidate."""
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px;">
      <h2 style="color: #f97316;">Interview Invitation</h2>
      <p>Dear <strong>{candidate_name}</strong>,</p>
      <p>Thank you for your application. We are pleased to invite you to an interview for the <strong>{job_title}</strong> position.</p>
      <p>Please use the link below to schedule your interview:</p>
      <p style="margin: 24px 0;">
        <a href="{interview_link}" style="background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          Schedule My Interview
        </a>
      </p>
      <p style="color: #6b7280; font-size: 13px;">If the button doesn't work: <a href="{interview_link}" style="color: #f97316;">{interview_link}</a></p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">This email was sent by the HRMS Recruitment Team.</p>
    </div>
    """
    _send(to, f"Interview Scheduling — {job_title}", html_body, html=True)


async def send_job_offer_email(to: str, candidate_name: str, job_title: str) -> None:
    """Sends a job offer notification to a candidate."""
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px;">
      <h2 style="color: #22c55e;">Congratulations — Job Offer!</h2>
      <p>Dear <strong>{candidate_name}</strong>,</p>
      <p>We are delighted to extend a formal job offer for the <strong>{job_title}</strong> position.</p>
      <p>Our HR team will be in touch shortly with the official offer letter and next steps.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">This email was sent by the HRMS Recruitment Team.</p>
    </div>
    """
    _send(to, f"Job Offer — {job_title}", html_body, html=True)


async def send_rejection_email(to: str, candidate_name: str, job_title: str) -> None:
    """Sends a polite rejection notification to a candidate."""
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px;">
      <h2 style="color: #f97316;">Application Update — {job_title}</h2>
      <p>Dear <strong>{candidate_name}</strong>,</p>
      <p>Thank you for interviewing for the <strong>{job_title}</strong> position. After careful consideration, we regret that we will not be moving forward with your application at this time.</p>
      <p>We wish you all the best in your career journey.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">This email was sent by the HRMS Recruitment Team.</p>
    </div>
    """
    _send(to, f"Application Update — {job_title}", html_body, html=True)
