"""
migrate_time_entries.py -- Adds columns + backfills existing rows.
Run once:  python migrate_time_entries.py
"""
from dotenv import load_dotenv
load_dotenv()

import os
import psycopg2

DB_URL = (
    f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
    f"@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
)

conn = psycopg2.connect(DB_URL)

# ── Add new columns (safe to re-run) ────────────────────────────────────────────
migrations = [
    ("employee_id column",
     "ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS employee_id VARCHAR;"),
    ("total_hours column",
     "ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS total_hours NUMERIC(8,4);"),
    ("overtime column",
     "ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS overtime NUMERIC(8,4);"),
    ("status column",
     "ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'completed';"),
]

print("-- Adding columns --")
for label, sql in migrations:
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
        print(f"  [OK] {label}")
    except Exception as e:
        conn.rollback()
        print(f"  [SKIP] {label}: {e}")

# ── Backfill existing rows using actual column names ─────────────────────────────
print("\n-- Backfilling existing rows --")
try:
    with conn.cursor() as cur:
        # status: set based on whether end_time exists
        cur.execute(
            "UPDATE time_entries SET status = 'completed' "
            "WHERE end_time IS NOT NULL AND (status IS NULL OR status = 'active');"
        )
        cur.execute(
            "UPDATE time_entries SET status = 'active' "
            "WHERE end_time IS NULL AND (status IS NULL OR status = 'completed');"
        )
        # total_hours from total_seconds (if total_hours not already set)
        cur.execute(
            "UPDATE time_entries SET total_hours = total_seconds / 3600.0 "
            "WHERE total_hours IS NULL AND total_seconds IS NOT NULL;"
        )
        # overtime = max(0, total_hours - 8)
        cur.execute(
            "UPDATE time_entries SET overtime = "
            "CASE WHEN total_hours > 8 THEN total_hours - 8 ELSE 0 END "
            "WHERE overtime IS NULL AND total_hours IS NOT NULL;"
        )
        # date from start_time (if date not already set)
        cur.execute(
            "UPDATE time_entries SET date = TO_CHAR(start_time, 'YYYY-MM-DD') "
            "WHERE date IS NULL AND start_time IS NOT NULL;"
        )
    conn.commit()
    print("  [OK] Backfilled status, total_hours, overtime, date")
except Exception as e:
    conn.rollback()
    print(f"  [ERROR] Backfill failed: {e}")

conn.close()
print("\nMigration complete.")
