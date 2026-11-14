from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.deps import SessionDep

router = APIRouter(tags=["status"])


@router.get("/api")
def read_root() -> dict[str, str]:
    return {"name": "SAERPA", "service": "api"}


@router.get("/api/health")
def health(session: SessionDep) -> dict[str, str]:
    try:
        session.execute(select(1))
    except SQLAlchemyError as error:
        raise HTTPException(status_code=503, detail="PostgreSQL indisponível.") from error

    return {"status": "ok", "service": "api", "database": "postgresql"}
