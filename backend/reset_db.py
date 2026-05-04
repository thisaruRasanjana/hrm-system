import os
import glob
from app.database.database import engine
from app.database.base import Base

def reset():
    print("Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("Creating all tables...")
    Base.metadata.create_all(bind=engine)
    print("Database cleared.")

    cvs_path = "uploads/cvs/*"
    files = glob.glob(cvs_path)
    for f in files:
        try:
            os.remove(f)
            print(f"Deleted {f}")
        except Exception as e:
            print(f"Error deleting {f}: {e}")

if __name__ == "__main__":
    reset()
