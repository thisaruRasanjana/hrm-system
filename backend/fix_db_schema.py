from app.database.database import engine
from app.database.base import Base
from sqlalchemy import text
import urllib.parse
import os
from dotenv import load_dotenv

load_dotenv()

def fix_db():
    print("Dropping problematic tables to fix schema mismatch...")
    # Order matters due to foreign keys
    tables_to_drop = [
        "user_roles",
        "role_permissions",
        "permissions",
        "roles"
    ]
    
    with engine.connect() as conn:
        for table in tables_to_drop:
            print(f"  Dropping {table}...")
            conn.execute(text(f"DROP TABLE IF EXISTS {table} CASCADE"))
        conn.commit()

    print("Recreating tables with current models...")
    Base.metadata.create_all(bind=engine)
    print("Done. Now run the server and it will seed automatically.")

if __name__ == "__main__":
    fix_db()
