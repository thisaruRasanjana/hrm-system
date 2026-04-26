import psycopg2
from app.database.database import engine

# Connect directly using psycopg2
url = engine.url.render_as_string(hide_password=False)
conn = psycopg2.connect(url)
conn.autocommit = True
cur = conn.cursor()

try:
    cur.execute("ALTER TABLE roles RENAME COLUMN role_name TO name;")
    print("Renamed role_name to name in roles table.")
except Exception as e:
    print(e)

try:
    cur.execute("ALTER TABLE roles ADD COLUMN is_system INTEGER DEFAULT 0;")
    print("Added is_system to roles table.")
except Exception as e:
    print(e)

try:
    cur.execute("ALTER TABLE permissions RENAME COLUMN permission_name TO name;")
    print("Renamed permission_name to name in permissions table.")
except Exception as e:
    print(e)

print("Database schema migration complete.")
