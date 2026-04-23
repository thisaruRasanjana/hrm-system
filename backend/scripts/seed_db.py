import sys
import os
from datetime import date

# Add the parent directory to sys.path so we can import from 'app'
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database.database import SessionLocal, engine
from app.database.base import Base
from app.employees.models import Employee
from app.departments.models import Department
from app.roles.models import Role
from app.auth.models import User  # Import all models to ensure they're registered

def seed_data():
    # Create all tables first
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Check if we already have data
        if db.query(Employee).count() > 0:
            print("Database already contains data. Skipping seed.")
            return

        # Create departments first
        departments_data = ["Engineering", "Human Resources", "Marketing", "Finance"]
        departments = {}
        for dept_name in departments_data:
            dept = db.query(Department).filter(Department.name == dept_name).first()
            if not dept:
                dept = Department(name=dept_name)
                db.add(dept)
            departments[dept_name] = dept
        
        db.commit()

        # Now create employees with proper department IDs
        example_employees = [
            Employee(
                employee_id="EMP-1001",
                first_name="John",
                last_name="Doe",
                email="john.doe@example.com",
                phone="0112345671",
                address="123 Main St, Colombo",
                department_id=departments["Engineering"].id,
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
                department_id=departments["Human Resources"].id,
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
                department_id=departments["Marketing"].id,
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
                department_id=departments["Engineering"].id,
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
