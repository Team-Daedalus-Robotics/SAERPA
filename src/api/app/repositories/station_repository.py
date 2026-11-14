from sqlalchemy import select
from sqlalchemy.orm import Session

from saerpa_shared.models import Station


def create(session: Session, unique_identifier: str) -> Station:
    station = Station(unique_identifier=unique_identifier)
    session.add(station)
    session.flush()
    return station


def list_all(session: Session) -> list[Station]:
    return list(session.scalars(select(Station)).all())


def get_by_id(session: Session, station_id: int) -> Station | None:
    return session.get(Station, station_id)
