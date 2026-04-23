from dotenv import load_dotenv; load_dotenv()
import os, psycopg2
conn = psycopg2.connect(
    f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
)
cur = conn.cursor()
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='time_entries' ORDER BY ordinal_position")
print([r[0] for r in cur.fetchall()])
conn.close()
