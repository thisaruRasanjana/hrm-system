from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from app.core.config import (
    MAIL_USERNAME, MAIL_PASSWORD, MAIL_FROM,
    MAIL_PORT, MAIL_SERVER,
)

conf = ConnectionConfig(
    MAIL_USERNAME=MAIL_USERNAME,
    MAIL_PASSWORD=MAIL_PASSWORD,
    MAIL_FROM=MAIL_FROM,
    MAIL_PORT=MAIL_PORT,
    MAIL_SERVER=MAIL_SERVER,
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=False,   # macOS: Python doesn't load system root CAs by default
)


async def send_scheduling_email(
    to: str,
    candidate_name: str,
    job_title: str,
    interview_link: str,
) -> None:
    """Sends an interview scheduling link to a candidate."""

    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px;">
      <h2 style="color: #f97316;">Interview Invitation</h2>
      <p>Dear <strong>{candidate_name}</strong>,</p>
      <p>
        Thank you for your application. We are pleased to invite you to an interview
        for the <strong>{job_title}</strong> position.
      </p>
      <p>Please use the link below to schedule your interview at a time that works for you:</p>
      <p style="margin: 24px 0;">
        <a href="{interview_link}"
           style="background: #f97316; color: white; padding: 12px 24px;
                  border-radius: 8px; text-decoration: none; font-weight: bold;">
          Schedule My Interview
        </a>
      </p>
      <p style="color: #6b7280; font-size: 13px;">
        If the button doesn't work, copy and paste this link into your browser:<br/>
        <a href="{interview_link}" style="color: #f97316;">{interview_link}</a>
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">
        This email was sent by the HRMS Recruitment Team.
      </p>
    </div>
    """

    message = MessageSchema(
        subject=f"Interview Scheduling — {job_title}",
        recipients=[to],
        body=html_body,
        subtype=MessageType.html,
    )

    fm = FastMail(conf)
    await fm.send_message(message)


async def send_job_offer_email(
    to: str,
    candidate_name: str,
    job_title: str,
) -> None:
    """Sends a job offer notification to a candidate."""
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px;">
      <h2 style="color: #22c55e;">Congratulations — Job Offer!</h2>
      <p>Dear <strong>{candidate_name}</strong>,</p>
      <p>
        We are delighted to inform you that after careful consideration of your interview performance,
        we are pleased to extend a formal job offer for the <strong>{job_title}</strong> position.
      </p>
      <p>
        Our HR team will be in touch shortly with the official offer letter and next steps.
        We look forward to welcoming you to our team!
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">This email was sent by the HRMS Recruitment Team.</p>
    </div>
    """
    message = MessageSchema(
        subject=f"Job Offer — {job_title}",
        recipients=[to],
        body=html_body,
        subtype=MessageType.html,
    )
    fm = FastMail(conf)
    await fm.send_message(message)


async def send_rejection_email(
    to: str,
    candidate_name: str,
    job_title: str,
) -> None:
    """Sends a polite rejection notification to a candidate."""
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px;">
      <h2 style="color: #f97316;">Application Update — {job_title}</h2>
      <p>Dear <strong>{candidate_name}</strong>,</p>
      <p>
        Thank you for taking the time to interview with us for the <strong>{job_title}</strong> position.
        After careful consideration, we regret to inform you that we will not be moving forward
        with your application at this time.
      </p>
      <p>
        We truly appreciate your interest in our company and encourage you to apply for future
        openings that match your skills and experience.
      </p>
      <p>We wish you all the best in your career journey.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">This email was sent by the HRMS Recruitment Team.</p>
    </div>
    """
    message = MessageSchema(
        subject=f"Application Update — {job_title}",
        recipients=[to],
        body=html_body,
        subtype=MessageType.html,
    )
    fm = FastMail(conf)
    await fm.send_message(message)
