from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from saerpa_shared.models import Event


def get_latest_timestamp(session: Session, station_id: int) -> datetime | None:
    return session.scalar(select(func.max(Event.timestamp)).where(Event.station_id == station_id))


def list_values(session: Session, station_id: int, measure_type: str, since: datetime) -> list[tuple[datetime, float]]:
    statement = (
        select(Event.timestamp, Event.value)
        .where(Event.station_id == station_id, Event.measure_type == measure_type, Event.timestamp >= since)
        .order_by(Event.timestamp)
    )
    return [(timestamp, float(value)) for timestamp, value in session.execute(statement).all()]
