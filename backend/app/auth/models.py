from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from app.database.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=True)   # ← new: for username login
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    refresh_token = Column(String, nullable=True)

    # Role & Position (string kept for backward compat; role_id is the authoritative source)
    role = Column(String, default='employee')
    position = Column(String, nullable=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)    # ← new: FK to roles table

    # Profile Fields
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    employee_id = Column(String, unique=True, nullable=True)
    department = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    address = Column(String, nullable=True)
    date_of_birth = Column(String, nullable=True)
    emergency_contact_number = Column(String, nullable=True)
    profile_image_url = Column(String, nullable=True)

    two_factor_enabled = Column(Boolean, default=False)
    totp_secret = Column(String, nullable=True)

    notification_preferences = Column(JSONB, nullable=True)
    quiet_hours_start = Column(String, default='22:00')
    quiet_hours_end = Column(String, default='08:00')