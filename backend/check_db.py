import os, psycopg2, dotenv
dotenv.load_dotenv()
try:
    conn = psycopg2.connect(
        host=os.getenv('DB_HOST'),
        port=os.getenv('DB_PORT'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        dbname=os.getenv('DB_NAME')
    )
    cur = conn.cursor()
    print("Checking 'time_entries' table columns...")
    cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'time_entries'")
    rows = cur.fetchall()
    if not rows:
        print("Table 'time_entries' does not exist!")
    for col, dtype in rows:
        print(f"{col}: {dtype}")
    conn.close()
except Exception as e:
    print(f"Error: {e}")
