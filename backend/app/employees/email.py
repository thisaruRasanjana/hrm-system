import smtplib
import os
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_SERVER", os.getenv("SMTP_HOST"))
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_EMAIL", os.getenv("SMTP_USER"))
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM = os.getenv("SMTP_EMAIL", os.getenv("SMTP_FROM"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


def send_welcome_email(email: str, full_name: str, temp_password: str):
    """
    Sends a welcome email with a temporary password and a link to reset it.
    If email sending fails, it logs the error but doesn't raise an exception.
    """
    if not all([SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM]):
        logger.error("SMTP configuration is incomplete. Skipping email sending.")
        return

    subject = "Welcome to the HRM System!"
    reset_url = f"{FRONTEND_URL}/auth/reset-password"
    
    html_content = f"""
    <html>
        <body>
            <h3>Welcome, {full_name}!</h3>
            <p>Your account has been created successfully. Below are your login credentials:</p>
            <ul>
                <li><strong>Email:</strong> {email}</li>
                <li><strong>Temporary Password:</strong> {temp_password}</li>
            </ul>
            <p>Please note that you <strong>must</strong> change your password on your first login for security reasons.</p>
            <p>
                <a href="{reset_url}" style="padding: 10px 20px; background-color: #EE7F22; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    Set New Password
                </a>
            </p>
            <p>If the button above does not work, copy and paste this link into your browser:<br>
            {reset_url}</p>
        </body>
    </html>
    """

    msg = MIMEMultipart()
    msg["From"] = SMTP_FROM
    msg["To"] = email
    msg["Subject"] = subject
    msg.attach(MIMEText(html_content, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        logger.info(f"Welcome email sent successfully to {email}")
    except Exception as e:
        logger.error(f"Failed to send welcome email to {email}: {str(e)}")
