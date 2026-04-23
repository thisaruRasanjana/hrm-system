from dotenv import load_dotenv; load_dotenv()
import os, psycopg2, json

conn = psycopg2.connect(
    f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
    f"@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
)
cur = conn.cursor()
cur.execute("SELECT r.name, r.permissions FROM roles r")
for name, perms in cur.fetchall():
    p = perms if isinstance(perms, list) else json.loads(perms or "[]")
    print(f"{name}: {p}")
conn.close()
