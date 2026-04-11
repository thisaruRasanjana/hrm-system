import sys
import os
from datetime import date

# Add the parent directory to sys.path so we can import from 'app'
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database.database import SessionLocal
from app.employees.models import Employee

def seed_data():
    db = SessionLocal()
    try:
        # Check if we already have data
        if db.query(Employee).count() > 0:
            print("Database already contains data. Skipping seed.")
            return

        example_employees = [
            Employee(
                employee_id="EMP-1001",
                first_name="John",
                last_name="Doe",
                email="john.doe@example.com",
                phone="0112345671",
                address="123 Main St, Colombo",
                department="Engineering",
                designation="Senior Developer",
                joined_date=date(2023, 1, 15),
                status="active"
            ),
            Employee(
                employee_id="EMP-1002",
                first_name="Jane",
                last_name="Smith",
                email="jane.smith@example.com",
                phone="0112345672",
                address="456 Park Ave, Kandy",
                department="Human Resources",
                designation="HR Manager",
                joined_date=date(2023, 3, 10),
                status="active"
            ),
            Employee(
                employee_id="EMP-1003",
                first_name="Michael",
                last_name="Chen",
                email="michael.chen@example.com",
                phone="0112345673",
                address="789 Galle Rd, Colombo",
                department="Marketing",
                designation="Marketing Lead",
                joined_date=date(2023, 6, 22),
                status="inactive"
            ),
            Employee(
                employee_id="EMP-1004",
                first_name="Sarah",
                last_name="Wilson",
                email="sarah.wilson@example.com",
                phone="0112345674",
                address="321 Temple Rd, Kandy",
                department="Engineering",
                designation="QA Engineer",
                joined_date=date(2024, 1, 5),
                status="active"
            )
        ]

        db.add_all(example_employees)
        db.commit()
        print(f"Successfully seeded {len(example_employees)} employees.")
    except Exception as e:
        print(f"Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
