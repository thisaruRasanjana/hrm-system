from dotenv import load_dotenv; load_dotenv()
import os, psycopg2, urllib.parse
p = urllib.parse.quote_plus(os.getenv('DB_PASSWORD',''))
conn = psycopg2.connect(
    f"postgresql://{os.getenv('DB_USER')}:{p}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
)
cur = conn.cursor()
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='permissions' ORDER BY ordinal_position")
print("Permissions columns:", [r[0] for r in cur.fetchall()])
conn.close()
