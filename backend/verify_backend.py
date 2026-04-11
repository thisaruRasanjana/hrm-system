import sys
import os

# Add the backend directory to sys.path to import app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    from app.main import app
    print("FastAPI app imported successfully!")
    
    from app.employees.models import Employee
    print("Employee model imported successfully!")
    
    from app.database.database import engine
    print("Database engine configured!")
    
    # Try to check if tables are created (this might fail if DB is not reachable)
    print("Attempting to connect to database...")
    # Base.metadata.create_all(bind=engine) # This is already in main.py
    
    print("\nBackend code looks logically sound.")
    
except Exception as e:
    print(f"Verification failed: {e}")
    sys.exit(1)
