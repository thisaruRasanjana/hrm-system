import sys
import os
sys.path.insert(0, os.path.abspath('.'))

from app.database.database import engine
from sqlalchemy import text

def check_employees():
    with engine.connect() as con:
        result = con.execute(text("SELECT id, first_name, last_name, role_id FROM employees"))
        print("Employees in database:")
        for row in result:
            print(f"- ID: {row[0]}, Name: {row[1]} {row[2]}, Role ID: {row[3]}")

if __name__ == "__main__":
    try:
        check_employees()
    except Exception as e:
        print(f"Error checking employees: {e}")
