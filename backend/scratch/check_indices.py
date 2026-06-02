import sys
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv()
from sqlalchemy import text
from app.database.database import engine

with engine.connect() as conn:
    print('Indices on users table:')
    rows = conn.execute(text("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'users'")).fetchall()
    for r in rows:
        print(f'{r[0]}: {r[1]}')
