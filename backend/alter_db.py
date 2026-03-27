import sys
import os

# Add backend directory to sys.path so 'app' is resolvable
sys.path.insert(0, os.path.abspath('.'))

from app.database.database import engine
from sqlalchemy import text

try:
    with engine.connect() as con:
        con.execute(text("ALTER TABLE document_requests ALTER COLUMN employee_id DROP NOT NULL;"))
        con.execute(text("ALTER TABLE document_requests ADD COLUMN source VARCHAR DEFAULT 'INTERNAL';"))
        con.execute(text("ALTER TABLE document_requests ADD COLUMN requester_email VARCHAR;"))
        con.commit()
    print("Database altered successfully!")
except Exception as e:
    print(f"Error altering database: {e}")
