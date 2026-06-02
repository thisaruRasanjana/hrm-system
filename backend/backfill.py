from dotenv import load_dotenv; load_dotenv()
import os, psycopg2
conn = psycopg2.connect(
    f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
    f"@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
)
with conn.cursor() as cur:
    cur.execute("UPDATE time_entries SET status='completed' WHERE end_time IS NOT NULL AND (status IS NULL OR status='active')")
    cur.execute("UPDATE time_entries SET status='active' WHERE end_time IS NULL AND (status IS NULL OR status='completed')")
    cur.execute("UPDATE time_entries SET total_hours=total_seconds/3600.0 WHERE total_hours IS NULL AND total_seconds IS NOT NULL")
    cur.execute("UPDATE time_entries SET overtime=CASE WHEN total_hours>8 THEN total_hours-8 ELSE 0 END WHERE overtime IS NULL AND total_hours IS NOT NULL")
    cur.execute("UPDATE time_entries SET date=start_time::date WHERE date IS NULL AND start_time IS NOT NULL")
conn.commit()
conn.close()
print("Backfill complete")
