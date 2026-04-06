from sqlalchemy import Column, Integer, String, Boolean
from app.database.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    refresh_token = Column(String, nullable=True)

    # Added Settings Fields
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    employee_id = Column(String, nullable=True)
    department = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    address = Column(String, nullable=True)
    date_of_birth = Column(String, nullable=True)
    emergency_contact_number = Column(String, nullable=True)
    profile_image_url = Column(String, nullable=True)
    
    two_factor_enabled = Column(Boolean, default=False)
    totp_secret = Column(String, nullable=True)
    
    from sqlalchemy.dialects.postgresql import JSONB
    notification_preferences = Column(JSONB, nullable=True)
    quiet_hours_start = Column(String, default='22:00')
    quiet_hours_end = Column(String, default='08:00')
