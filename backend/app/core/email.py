import os
import smtplib
from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv()

SMTP_SERVER = os.getenv("MAIL_SERVER")
SMTP_PORT_STR = os.getenv("MAIL_PORT", "587")
SMTP_PORT = int(SMTP_PORT_STR)
SMTP_EMAIL = os.getenv("MAIL_USERNAME")
SMTP_PASSWORD = os.getenv("MAIL_PASSWORD")
MAIL_FROM = os.getenv("MAIL_FROM")


def _send(to_email: str, subject: str, body: str, html: bool = False):
    """Internal SMTP send helper. Skips silently if mail config is missing (dev mode)."""
    if not all([SMTP_SERVER, SMTP_EMAIL, SMTP_PASSWORD, MAIL_FROM]):
        print(f"[EMAIL SKIPPED] {subject} → {to_email} (mail config not set)")
        return
    try:
        mime_type = "html" if html else "plain"
        msg = MIMEText(body, mime_type)
        msg["Subject"] = subject
        msg["From"] = MAIL_FROM
        msg["To"] = to_email
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.sendmail(MAIL_FROM, to_email, msg.as_string())
        server.quit()
    except Exception as e:
        print(f"[ERROR] Failed to send email: {e}")


def send_otp_email(to_email: str, otp: str):
    _send(to_email, "HRM Password Reset OTP", f"Your OTP for password reset is: {otp}")


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
