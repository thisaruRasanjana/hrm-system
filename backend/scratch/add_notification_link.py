from app.database.database import engine
from sqlalchemy import text

def add_column():
    with engine.connect() as conn:
        conn.execute(text('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link VARCHAR'))
        conn.commit()
        print('Column "link" added to "notifications" table.')

if __name__ == "__main__":
    add_column()
