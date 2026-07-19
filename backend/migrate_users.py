import sys
import os

# Add backend directory to sys.path so 'app' is resolvable
sys.path.insert(0, os.path.abspath('.'))

from app.database.database import engine
from sqlalchemy import text

try:
    with engine.connect() as con:
        con.execute(text("ALTER TABLE users ADD COLUMN notification_retention_days INTEGER;"))
        con.commit()
    print("Database altered successfully!")
except Exception as e:
    print(f"Error altering database: {e}")
