"""
migrate_pause_resume.py — Adds tables + backfills existing time_entries
into the new check-pair model.
Run once:  python migrate_pause_resume.py
Safe to re-run (idempotent).
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

# ── 1. Create new tables (safe to re-run) ──────────────────────────────────────
print("-- Creating tables --")
tables = [
    ("time_check_pairs", """
        CREATE TABLE IF NOT EXISTS time_check_pairs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            date DATE NOT NULL,
            check_in TIMESTAMP NOT NULL,
            check_out TIMESTAMP,
            seconds INTEGER,
            created_at TIMESTAMP DEFAULT now()
        )
    """),
    ("overtime_threshold_history", """
        CREATE TABLE IF NOT EXISTS overtime_threshold_history (
            id SERIAL PRIMARY KEY,
            threshold_hours NUMERIC(5,2) NOT NULL,
            effective_date DATE NOT NULL,
            created_by_user_id INTEGER,
            created_at TIMESTAMP DEFAULT now()
        )
    """),
]

for name, sql in tables:
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
        print(f"  [OK] {name}")
    except Exception as e:
        conn.rollback()
        print(f"  [SKIP] {name}: {e}")

# ── 2. Add new columns ────────────────────────────────────────────────────────────
print("\n-- Adding columns --")
columns = [
    ("time_entries.applied_threshold",
     "ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS applied_threshold NUMERIC(5,2);"),
]
for label, sql in columns:
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
        print(f"  [OK] {label}")
    except Exception as e:
        conn.rollback()
        print(f"  [SKIP] {label}: {e}")

# ── 3. Create indexes ─────────────────────────────────────────────────────────────
print("\n-- Creating indexes --")
indexes = [
    "CREATE INDEX IF NOT EXISTS idx_time_check_pairs_user_date ON time_check_pairs (user_id, date)",
    "CREATE INDEX IF NOT EXISTS idx_overtime_threshold_effective ON overtime_threshold_history (effective_date)",
]
for sql in indexes:
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
        print(f"  [OK] index created")
    except Exception as e:
        conn.rollback()
        print(f"  [SKIP] index: {e}")

# ── 4. Backfill: create one TimeCheckPair per existing time_entry ─────────────────
print("\n-- Backfilling time_check_pairs from time_entries --")
try:
    with conn.cursor() as cur:
        # Only backfill entries that don't already have a corresponding pair
        cur.execute("""
            INSERT INTO time_check_pairs (user_id, date, check_in, check_out, seconds, created_at)
            SELECT
                te.user_id,
                COALESCE(te.date, te.start_time::date),
                te.start_time,
                te.end_time,
                te.total_seconds,
                COALESCE(te.created_at, now())
            FROM time_entries te
            WHERE NOT EXISTS (
                SELECT 1 FROM time_check_pairs tcp
                WHERE tcp.user_id = te.user_id
                  AND tcp.check_in = te.start_time
            )
              AND te.start_time IS NOT NULL
        """)
        count = cur.rowcount
    conn.commit()
    print(f"  [OK] Backfilled {count} check pairs from existing time_entries")
except Exception as e:
    conn.rollback()
    print(f"  [ERROR] Backfill failed: {e}")

# ── 5. Backfill applied_threshold for completed entries ───────────────────────────
print("\n-- Backfilling applied_threshold on completed entries --")
try:
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE time_entries
            SET applied_threshold = 8.00
            WHERE applied_threshold IS NULL
              AND status = 'completed'
        """)
        count = cur.rowcount
    conn.commit()
    print(f"  [OK] Set applied_threshold=8.00 on {count} completed entries")
except Exception as e:
    conn.rollback()
    print(f"  [ERROR] Backfill applied_threshold failed: {e}")

# ── 6. Seed default overtime threshold if empty ───────────────────────────────────
print("\n-- Seeding default overtime threshold --")
try:
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM overtime_threshold_history")
        (count,) = cur.fetchone()
        if count == 0:
            cur.execute("""
                INSERT INTO overtime_threshold_history (threshold_hours, effective_date)
                VALUES (8.00, '2000-01-01')
            """)
            conn.commit()
            print("  [OK] Default threshold (8h) seeded")
        else:
            print(f"  [SKIP] Already has {count} threshold row(s)")
except Exception as e:
    conn.rollback()
    print(f"  [ERROR] Seed failed: {e}")

conn.close()
print("\nMigration complete.")
