import sys
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv()
from sqlalchemy import text
from app.database.database import engine

with engine.connect() as conn:
    rows = conn.execute(text("SELECT id, email, is_deleted FROM users WHERE email = 'sanduniliyanage045@gmail.com' ORDER BY id")).fetchall()
    print(f"Found {len(rows)} records for sanduniliyanage045@gmail.com:")
    for r in rows:
        print(f"ID: {r[0]}, Email: {r[1]}, is_deleted: {r[2]}")
