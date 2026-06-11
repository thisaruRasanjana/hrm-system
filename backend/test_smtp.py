"""Run this directly to test SMTP: py test_smtp.py"""
import smtplib
import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)

host = os.getenv("MAIL_SERVER", "smtp.gmail.com")
port = int(os.getenv("MAIL_PORT", "587"))
user = os.getenv("MAIL_USERNAME", "")
password = (os.getenv("MAIL_PASSWORD") or "").replace(" ", "")
mail_from = os.getenv("MAIL_FROM", "")

print(f"Host    : {host}:{port}")
print(f"User    : {user}")
print(f"Password: {password[:4]}...{password[-4:]} (len={len(password)})")
print()

try:
    if port == 465:
        server = smtplib.SMTP_SSL(host, port, timeout=10)
    else:
        server = smtplib.SMTP(host, port, timeout=10)
        code, msg = server.starttls()
        print(f"STARTTLS: {code} {msg}")

    code, msg = server.login(user, password)
    print(f"LOGIN OK: {code} {msg}")
    server.quit()
    print("\n✓ SMTP works — credentials are correct.")
except smtplib.SMTPAuthenticationError as e:
    print(f"\n✗ Auth failed (535): {e}")
    print("\nPossible causes:")
    print("  1. App Password not yet active — wait 1 minute and retry")
    print("  2. 2-Step Verification is OFF — App Passwords only work with 2FA enabled")
    print("  3. Google Workspace account — admin may have disabled SMTP")
    print("  4. Account locked — sign in to Gmail in browser first")
except Exception as e:
    print(f"\n✗ Connection error: {e}")
