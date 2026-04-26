import os
import smtplib
from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv()

# Use MAIL_* to match the user's environment variable specification
SMTP_SERVER = os.getenv("MAIL_SERVER")
if not SMTP_SERVER:
    raise RuntimeError("MAIL_SERVER environment variable is not set.")

SMTP_PORT_STR = os.getenv("MAIL_PORT")
if not SMTP_PORT_STR:
    raise RuntimeError("MAIL_PORT environment variable is not set.")
SMTP_PORT = int(SMTP_PORT_STR)

SMTP_EMAIL = os.getenv("MAIL_USERNAME")
if not SMTP_EMAIL:
    raise RuntimeError("MAIL_USERNAME environment variable is not set.")

SMTP_PASSWORD = os.getenv("MAIL_PASSWORD")
if not SMTP_PASSWORD:
    raise RuntimeError("MAIL_PASSWORD environment variable is not set.")

MAIL_FROM = os.getenv("MAIL_FROM")
if not MAIL_FROM:
    raise RuntimeError("MAIL_FROM environment variable is not set.")


def send_otp_email(to_email: str, otp: str):
    subject = "HRM Password Reset OTP"
    body = f"Your OTP for password reset is: {otp}"

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = MAIL_FROM
    msg["To"] = to_email

    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.sendmail(MAIL_FROM, to_email, msg.as_string())
        server.quit()
    except Exception as e:
        print(f"[ERROR] Failed to send email: {e}")
