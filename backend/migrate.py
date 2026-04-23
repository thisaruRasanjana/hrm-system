"""
migrate.py  -- Run once to add new columns to existing tables.
Usage:  python migrate.py

Safe to run multiple times (uses IF NOT EXISTS / tries each ALTER separately).
"""

import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()

DB_URL = (
    f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
    f"@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
)


def run(conn, sql: str, label: str):
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
        print(f"  [OK] {label}")
    except Exception as e:
        conn.rollback()
        print(f"  [SKIP] {label} -- {e}")


def main():
    print("Connecting to database...")
    conn = psycopg2.connect(DB_URL)
    print("Connected.\n")

    print("-- users table --")

    run(conn,
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR UNIQUE;",
        "username column")

    run(conn,
        """
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_name='users' AND column_name='role_id') THEN
            ALTER TABLE users ADD COLUMN role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL;
          END IF;
        END $$;
        """,
        "role_id FK column (requires roles table to exist first)")

    print("\n-- messages table --")

    run(conn,
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_id INTEGER;",
        "sender_id column")

    print("\nMigration complete.")
    conn.close()


if __name__ == "__main__":
    main()
