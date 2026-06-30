from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os
import urllib.parse

load_dotenv()

DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

# Prioritize full DATABASE_URL if it exists
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    ESCAPED_PASSWORD = urllib.parse.quote_plus(DB_PASSWORD)
    DATABASE_URL = (
        f"postgresql://{DB_USER}:{ESCAPED_PASSWORD}"
        f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )

print("DATABASE URL USED BY FASTAPI:", DATABASE_URL)

engine = create_engine(
    DATABASE_URL,
    # Health-check each connection before use — drops stale/closed connections
    # instead of returning them to the caller and causing timeouts.
    pool_pre_ping=True,
    # Allow up to 10 concurrent connections per worker (default is 5).
    pool_size=10,
    # Allow an additional 20 temporary connections under burst load.
    max_overflow=20,
    # Recycle connections that have been open for more than 30 minutes
    # to avoid issues with PostgreSQL's idle-connection limits.
    pool_recycle=1800,
    # Wait up to 60 s for a pool slot before raising TimeoutError.
    pool_timeout=60,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
