import app.main
from app.database.database import SessionLocal
from app.auth.models import User
from app.roles.models import Role
from passlib.context import CryptContext

db = SessionLocal()
admin_role = db.query(Role).filter_by(role_name="Super Admin").first()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

user = db.query(User).filter_by(email="admin@hrm.lk").first()
if not user:
    user = User(
        email="admin@hrm.lk",
        username="admin",
        password_hash=pwd_context.hash("Admin@123"),
        role="Super Admin",
        role_id=admin_role.id if admin_role else None,
        first_name="System",
        last_name="Admin",
        employee_id="EMP-001"
    )
    db.add(user)
    db.commit()
print("Admin user created/verified: email=admin@hrm.lk password=Admin@123")
db.close()
