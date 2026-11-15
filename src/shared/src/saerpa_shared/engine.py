import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_database_url = os.environ.get("DATABASE_URL")
if not _database_url:
    raise RuntimeError("DATABASE_URL não foi configurada pelo Aspire.")

# No Windows, "localhost" tenta resolver para IPv6 (::1) e o proxy de porta do
# Docker Desktop só escuta em IPv4 — a conexão pode demorar minutos. "127.0.0.1"
# conecta em menos de um segundo.
database_url = _database_url.replace("@localhost:", "@127.0.0.1:")

engine = create_engine(database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
