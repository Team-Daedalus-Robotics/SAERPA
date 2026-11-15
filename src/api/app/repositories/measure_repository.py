from sqlalchemy import select
from sqlalchemy.orm import Session

from saerpa_shared.models import Measure


def list_by_station(session: Session, station_id: int) -> list[Measure]:
    statement = select(Measure).where(Measure.station_id == station_id)
    return list(session.scalars(statement).all())
