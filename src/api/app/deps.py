from typing import Annotated

from sqlalchemy.orm import Session
from fastapi import Depends

from saerpa_shared.engine import SessionLocal


def get_session() -> Session:
    with SessionLocal() as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]
