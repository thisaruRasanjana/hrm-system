import sys
import os

sys.path.insert(0, os.path.abspath('.'))

from app.database.database import engine
from sqlalchemy import text

try:
    with engine.connect() as con:
        con.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category VARCHAR;"))
        con.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_type VARCHAR;"))
        con.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_id VARCHAR;"))
        con.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE NOT NULL;"))
        con.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;"))
        con.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE NOT NULL;"))
        con.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;"))
        con.commit()
    print("Database notifications altered successfully!")
except Exception as e:
    print(f"Error altering notifications database: {e}")
