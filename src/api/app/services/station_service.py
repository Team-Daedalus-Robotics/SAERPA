from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.exceptions import ConflictError, NotFoundError
from app.repositories import measure_repository, station_repository
from saerpa_shared.models import Measure, Station


def create_station(session: Session, unique_identifier: str) -> Station:
    station = station_repository.create(session, unique_identifier)

    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        raise ConflictError("Estação já existe.") from error
    except SQLAlchemyError as error:
        session.rollback()
        raise error

    session.refresh(station)
    return station


def list_stations(session: Session) -> list[Station]:
    return station_repository.list_all(session)


def get_station_or_raise(session: Session, station_id: int) -> Station:
    station = station_repository.get_by_id(session, station_id)
    if station is None:
        raise NotFoundError("Estação não encontrada.")
    return station


def list_measures(session: Session, station_id: int) -> list[Measure]:
    get_station_or_raise(session, station_id)
    return measure_repository.list_by_station(session, station_id)
