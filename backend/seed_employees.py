import sys
import os
from datetime import date
sys.path.insert(0, os.path.abspath('backend'))
from app.database.database import SessionLocal
from app.employees.models import Employee

db = SessionLocal()
try:
    if db.query(Employee).count() == 0:
        emps = [
            Employee(first_name="Alice", last_name="Johnson", email="alice@hrm.local", employee_number="EMP-001", department="Engineering", job_title="Lead Engineer", gender="F", date_joined=date(2023, 1, 15), is_active=1),
            Employee(first_name="Bob", last_name="Smith", email="bob@hrm.local", employee_number="EMP-002", department="Engineering", job_title="Senior Developer", gender="M", date_joined=date(2023, 6, 1), is_active=1),
            Employee(first_name="Charlie", last_name="Brown", email="charlie@hrm.local", employee_number="EMP-003", department="HR", job_title="HR Manager", gender="M", date_joined=date(2022, 11, 20), is_active=1)
        ]
        db.add_all(emps)
        db.commit()
        print("Seeded 3 employees.")
    else:
        print("Employees already exist.")
except Exception as e:
    print(f"Error seeding: {e}")
finally:
    db.close()
