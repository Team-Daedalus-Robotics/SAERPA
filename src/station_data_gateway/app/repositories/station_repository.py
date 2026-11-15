from sqlalchemy import select
from sqlalchemy.orm import Session

from saerpa_shared.models import Station

def get_by_unique_identifier(session: Session, unique_identifier: str) -> Station | None:
    statement = select(Station).where(Station.unique_identifier == unique_identifier)
    return session.scalars(statement).first()

def create(session: Session, unique_identifier: str) -> Station:
    station = Station(unique_identifier=unique_identifier)
    session.add(station)
    session.flush()
    return station
