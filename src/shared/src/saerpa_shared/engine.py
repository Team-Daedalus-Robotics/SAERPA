import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_database_url = os.environ.get("DATABASE_URL")
if not _database_url:
    raise RuntimeError("DATABASE_URL não foi configurada pelo Aspire.")

engine = create_engine(_database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
