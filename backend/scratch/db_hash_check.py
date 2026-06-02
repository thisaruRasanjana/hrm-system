import sys
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv()
from sqlalchemy import text
from app.database.database import engine

with engine.connect() as conn:
    rows = conn.execute(text(
        "SELECT email, LENGTH(hashed_password), hashed_password FROM users WHERE is_superadmin = FALSE OR is_superadmin IS NULL"
    )).fetchall()
    if not rows:
        print("No non-superadmin users found.")
    for r in rows:
        print(f"EMAIL:  {r[0]}")
        print(f"LENGTH: {r[1]}")
        print(f"HASH:   {r[2]}")
        print("---")
