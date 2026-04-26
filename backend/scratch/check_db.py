from sqlalchemy import MetaData, Table
from app.database.database import engine
metadata = MetaData()
employees = Table('employees', metadata, autoload_with=engine)
print("employees:", [c.name for c in employees.columns])
for fk in employees.foreign_key_constraints:
    print("FK:", fk)
