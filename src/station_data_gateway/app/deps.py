from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from saerpa_shared.engine import SessionLocal


def get_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


SessionDep = Annotated[Session, Depends(get_session)]
