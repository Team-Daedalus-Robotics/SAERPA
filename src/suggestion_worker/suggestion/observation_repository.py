import os
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from saerpa_shared.engine import SessionLocal
from saerpa_shared.models import Event, Measure, SatelliteObservation, Station

from suggestion.confing import QUERY_LIMIT

NASA_STATION_PREFIX = "nasa-power-"
SATELLITE_WINDOW_HOURS = int(os.getenv("SUGGESTION_SATELLITE_WINDOW_HOURS", "48"))
SATELLITE_OBSERVATION_DAYS = int(os.getenv("SUGGESTION_SATELLITE_DAYS", "7"))

SATELLITE_VARIABLES_BY_MEASURE_TYPE = {
    "soil_moisture": ["soil_moisture_surface", "soil_moisture_root_zone"],
    "soil_temperature": ["soil_temperature"],
    "air_temperature": ["air_temperature", "air_temperature_max", "air_temperature_min"],
    "air_humidity": ["air_humidity"],
    "rainfall": ["rainfall"],
}


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
            "event_id": event.id,
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
            "event_id": event.id,
            "measure_type": event.measure_type,
            "sensor_name": event.measure.sensor_name,
            "value": event.value,
            "measurement_unit": event.measure.measurement_unit,
            "timestamp": event.timestamp.isoformat() if event.timestamp else None,
        }
        for event in events
    ]


def event_ids(readings: list[dict]) -> list[int]:
    return [reading["event_id"] for reading in readings if "event_id" in reading]


def latest_satellite_observations(measure_types: list[str] | None = None) -> list[dict]:
    """Observações diárias de satélite (NASA POWER/SMAP) dos últimos dias, da tabela satellite_observation."""
    variables = {
        variable
        for measure_type in (measure_types or [])
        for variable in SATELLITE_VARIABLES_BY_MEASURE_TYPE.get(measure_type, [measure_type])
    }
    window_start = date.today() - timedelta(days=SATELLITE_OBSERVATION_DAYS)
    statement = (
        select(SatelliteObservation)
        .where(
            SatelliteObservation.deleted.is_(False),
            SatelliteObservation.observed_at >= window_start,
        )
        .order_by(SatelliteObservation.observed_at.desc(), SatelliteObservation.id.desc())
        .limit(QUERY_LIMIT)
    )
    if variables:
        statement = statement.where(SatelliteObservation.variable.in_(variables))
    with SessionLocal() as session:
        observations = session.scalars(statement).all()
    return [
        {
            "satellite_observation_id": observation.id,
            "source": observation.source,
            "product": observation.product,
            "variable": observation.variable,
            "depth": observation.depth,
            "measurement_unit": observation.measurement_unit,
            "observed_at": observation.observed_at.isoformat() if observation.observed_at else None,
            "value": observation.value,
            "cell_latitude": observation.cell_latitude,
            "cell_longitude": observation.cell_longitude,
        }
        for observation in observations
    ]


def satellite_observation_ids(observations: list[dict]) -> list[int]:
    return [
        observation["satellite_observation_id"]
        for observation in observations
        if "satellite_observation_id" in observation
    ]
