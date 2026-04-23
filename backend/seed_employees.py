from app.database.base import Base
from app.database.database import SessionLocal
from app.employees.models import Employee

def seed_employees():
    db = SessionLocal()
    try:
        if db.query(Employee).count() == 0:
            emp1 = Employee(first_name='John', last_name='Doe')
            emp2 = Employee(first_name='Jane', last_name='Smith')
            emp3 = Employee(first_name='Alice', last_name='Johnson')
            db.add_all([emp1, emp2, emp3])
            db.commit()
            print('Inserted 3 dummy employees.')
        else:
            print('Employees already exist.')
    finally:
        db.close()

if __name__ == '__main__':
    seed_employees()
