import sys
import os
sys.path.insert(0, os.path.abspath('.'))

from app.database.database import engine, SessionLocal
from app.documents.models.request_model import DocumentRequest
from app.employees.models import Employee

def test_query():
    db = SessionLocal()
    try:
        # This query simulates the one in get_all_hr_requests
        query = (
            db.query(DocumentRequest, Employee)
            .outerjoin(Employee, Employee.id == DocumentRequest.employee_id)
        )
        results = query.limit(5).all()
        print(f"Successfully fetched {len(results)} records.")
        for req, emp in results:
            emp_name = f"{emp.first_name} {emp.last_name}" if emp else "No employee"
            print(f"- Request ID: {req.id}, Employee: {emp_name}")
    finally:
        db.close()

if __name__ == "__main__":
    try:
        test_query()
    except Exception as e:
        print(f"Query failed: {e}")
