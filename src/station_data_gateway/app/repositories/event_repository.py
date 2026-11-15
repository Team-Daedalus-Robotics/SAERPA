from datetime import datetime

from sqlalchemy.orm import Session

from saerpa_shared.models import Event


def create(
    session: Session,
    station_id: int,
    measure_id: int,
    measure_type: str,
    value: str,
    timestamp: datetime,
) -> Event:
    event = Event(
        station_id=station_id,
        measure_id=measure_id,
        measure_type=measure_type,
        value=value,
        timestamp=timestamp,
    )
    session.add(event)
    session.flush()
    return event
