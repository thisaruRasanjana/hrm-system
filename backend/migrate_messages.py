from app.database.database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        print("Adding 'sender_permanent_deleted' to 'messages' table...")
        conn.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_permanent_deleted BOOLEAN DEFAULT FALSE"))
        conn.commit()
        print("[OK] Migration complete.")

if __name__ == "__main__":
    migrate()
