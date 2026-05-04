from app.database.database import engine
from app.database.base import Base

print("Tables before:", Base.metadata.tables.keys())
Base.metadata.create_all(bind=engine)
print("Created all tables.")
