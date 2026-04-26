from app.database.database import engine
from sqlalchemy import inspect

def check_columns():
    inspector = inspect(engine)
    
    print("\n-- Checking 'users' table --")
    columns = [c['name'] for c in inspector.get_columns('users')]
    print(f"Columns: {columns}")
    if 'is_superadmin' in columns:
        print("[OK] 'is_superadmin' exists in 'users'")
    else:
        print("[MISSING] 'is_superadmin' is NOT in 'users'")

    print("\n-- Checking 'messages' table --")
    columns = [c['name'] for c in inspector.get_columns('messages')]
    print(f"Columns: {columns}")
    if 'sender_permanent_deleted' in columns:
        print("[OK] 'sender_permanent_deleted' exists in 'messages'")
    else:
        print("[MISSING] 'sender_permanent_deleted' is NOT in 'messages'")

if __name__ == "__main__":
    check_columns()
