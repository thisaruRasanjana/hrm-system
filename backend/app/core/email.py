import os
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from dotenv import load_dotenv

load_dotenv()

conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME", ""),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD", ""),
    MAIL_FROM=os.getenv("MAIL_FROM", "noreply@hrm.local"),
    MAIL_PORT=int(os.getenv("MAIL_PORT", "587")),
    MAIL_SERVER=os.getenv("MAIL_SERVER", "smtp.gmail.com"),
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True,
)


async def send_scheduling_email(
    to: str,
    candidate_name: str,
    job_title: str,
    interview_link: str,
) -> None:
    """
    Sends an interview scheduling link to a candidate.
    The link is the panel's Cita / Google Meet link stored on InterviewPanel.
    """

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
