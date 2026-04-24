from app.database.database import engine
from sqlalchemy import text
import os
from dotenv import load_dotenv

load_dotenv()

def fix_db():
    print("Dropping the entire public schema to fix Alembic duplicate type errors...")
    
    with engine.connect() as conn:
        # Drop and recreate the public schema to wipe all tables and ENUM types
        conn.execute(text("DROP SCHEMA public CASCADE;"))
        conn.execute(text("CREATE SCHEMA public;"))
        conn.execute(text("GRANT ALL ON SCHEMA public TO postgres;"))
        conn.execute(text("GRANT ALL ON SCHEMA public TO public;"))
        conn.commit()

    print("Database wiped clean! You can now run `alembic upgrade head` and `python3 seed.py`.")

if __name__ == "__main__":
    fix_db()
