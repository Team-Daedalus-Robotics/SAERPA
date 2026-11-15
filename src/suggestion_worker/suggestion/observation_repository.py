import os
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from saerpa_shared.engine import SessionLocal
from saerpa_shared.models import Event, Measure, Station

NASA_STATION_PREFIX = "nasa-power-"
SATELLITE_WINDOW_HOURS = int(os.getenv("SUGGESTION_SATELLITE_WINDOW_HOURS", "48"))


def latest_sensor_readings(limit: int = 10) -> list[dict]:
    """Últimas leituras de sensores físicos (fora das estações NASA POWER)."""
    statement = (
        select(Event)
        .options(joinedload(Event.measure).joinedload(Measure.station))
        .join(Measure, Event.measure_id == Measure.id)
        .join(Station, Measure.station_id == Station.id)
        .where(Station.unique_identifier.notlike(f"{NASA_STATION_PREFIX}%"))
        .order_by(Event.timestamp.desc(), Event.id.desc())
        .limit(limit)
    )
    with SessionLocal() as session:
        events = session.scalars(statement).all()
    return [
        {
            "data_type": event.measure.data_type,
            "sensor_name": event.measure.sensor_name,
            "value": event.value,
            "measurement_unit": event.measure.measurement_unit,
        }
        for event in events
    ]


def latest_satellite_readings(measure_types: list[str] | None = None) -> list[dict]:
    """Leituras recentes das estações virtuais NASA POWER, filtráveis por measure_type."""
    window_start = datetime.now(timezone.utc) - timedelta(hours=SATELLITE_WINDOW_HOURS)
    statement = (
        select(Event)
        .options(joinedload(Event.measure).joinedload(Measure.station))
        .join(Measure, Event.measure_id == Measure.id)
        .join(Station, Measure.station_id == Station.id)
        .where(
            Station.unique_identifier.like(f"{NASA_STATION_PREFIX}%"),
            Event.timestamp >= window_start,
        )
        .order_by(Event.timestamp.desc(), Event.id.desc())
    )
    if measure_types:
        statement = statement.where(Event.measure_type.in_(measure_types))
    with SessionLocal() as session:
        events = session.scalars(statement).all()
    return [
        {
            "measure_type": event.measure_type,
            "sensor_name": event.measure.sensor_name,
            "value": event.value,
            "measurement_unit": event.measure.measurement_unit,
            "timestamp": event.timestamp.isoformat() if event.timestamp else None,
        }
        for event in events
    ]
