from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.orm import Session

from saerpa_shared.models import ClimateCell, Event, Station

REQUEST_TOUCH_INTERVAL = timedelta(minutes=10)


def register_request(session: Session, latitude: float, longitude: float, now: datetime) -> ClimateCell:
    """Registra que alguém pediu o clima desta célula (o nasa_event_worker é quem busca e grava em `event`)."""
    statement = (
        postgresql_insert(ClimateCell)
        .values(latitude=latitude, longitude=longitude, last_requested_at=now)
        .on_conflict_do_update(
            constraint="uq_climate_cell_position",
            set_={"last_requested_at": now},
            where=ClimateCell.last_requested_at < now - REQUEST_TOUCH_INTERVAL,
        )
    )
    session.execute(statement)
    session.commit()
    return session.scalars(select(ClimateCell).where(ClimateCell.latitude == latitude, ClimateCell.longitude == longitude)).one()


def find_station_id(session: Session, identifier: str) -> int | None:
    return session.scalar(select(Station.id).where(Station.unique_identifier == identifier))


def get_latest_timestamp(session: Session, station_id: int) -> datetime | None:
    return session.scalar(select(func.max(Event.timestamp)).where(Event.station_id == station_id))


def list_values(session: Session, station_id: int, measure_type: str, since: datetime) -> list[tuple[datetime, float]]:
    statement = (
        select(Event.timestamp, Event.value)
        .where(Event.station_id == station_id, Event.measure_type == measure_type, Event.timestamp >= since)
        .order_by(Event.timestamp)
    )
    return [(timestamp, float(value)) for timestamp, value in session.execute(statement).all()]
