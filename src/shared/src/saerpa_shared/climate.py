"""Grava dados reais da NASA POWER na tabela `event`, em uma estação virtual por célula da grade.

Cada célula (ver nasa_power.GridCell) vira uma estação `nasa-power-<lat>_<lng>` com 5 medidas.
Na primeira consulta a célula recebe 30 dias; depois só entra o que a NASA publicou de novo.
Usado pela API (sob demanda) e reaproveitável pelo nasa_event_worker.
"""
import threading
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, insert, select, text
from sqlalchemy.orm import Session

from saerpa_shared import nasa_power
from saerpa_shared.models import Event, Measure, Station

BACKFILL_DAYS = 30
FRESH_WITHIN = timedelta(days=2)
RETRY_AFTER = timedelta(hours=1)
DATA_TYPE = "number"


@dataclass(frozen=True)
class ClimateMeasure:
    type: str
    sensor_name: str
    measurement_unit: str
    nasa_parameter: str
    scale: float
    decimals: int

    def format(self, nasa_value: float) -> str:
        return f"{nasa_value * self.scale:.{self.decimals}f}"


CLIMATE_MEASURES = [
    ClimateMeasure("soil_moisture", "NASA POWER GWETTOP", "%", "GWETTOP", 100, 1),
    ClimateMeasure("soil_temperature", "NASA POWER TSOIL1", "°C", "TSOIL1", 1, 2),
    ClimateMeasure("air_temperature", "NASA POWER T2M", "°C", "T2M", 1, 2),
    ClimateMeasure("air_humidity", "NASA POWER RH2M", "%", "RH2M", 1, 1),
    ClimateMeasure("rainfall", "NASA POWER PRECTOTCORR", "mm/h", "PRECTOTCORR", 1, 2),
]

_last_attempt_by_cell: dict[str, datetime] = {}
_last_attempt_lock = threading.Lock()


def _get_or_create_station(session: Session, identifier: str) -> Station:
    station = session.scalar(select(Station).where(Station.unique_identifier == identifier))
    if station is None:
        station = Station(unique_identifier=identifier)
        session.add(station)
        session.flush()
    return station


def _get_or_create_measures(session: Session, station: Station) -> dict[str, Measure]:
    measures = {}
    for climate_measure in CLIMATE_MEASURES:
        measure = session.scalar(select(Measure).where(
            Measure.station_id == station.id, Measure.type == climate_measure.type, Measure.sensor_name == climate_measure.sensor_name))
        if measure is None:
            measure = Measure(station_id=station.id, type=climate_measure.type, sensor_name=climate_measure.sensor_name,
                              measurement_unit=climate_measure.measurement_unit, data_type=DATA_TYPE)
            session.add(measure)
            session.flush()
        measures[climate_measure.type] = measure
    return measures


def _recently_attempted(identifier: str, now: datetime) -> bool:
    with _last_attempt_lock:
        previous = _last_attempt_by_cell.get(identifier)
        if previous is not None and now - previous < RETRY_AFTER:
            return True
        _last_attempt_by_cell[identifier] = now
        return False


def refresh_climate_events(session: Session, cell: nasa_power.GridCell, now: datetime | None = None) -> Station:
    """Garante a estação da célula com eventos da NASA até o último dado publicado.

    Faz commit do que gravar. Se a NASA falhar e já houver dados, devolve os dados antigos;
    se não houver nenhum dado ainda, levanta NasaPowerError.
    """
    now = now or datetime.now(timezone.utc)
    session.execute(text("select pg_advisory_xact_lock(hashtext(:key))"), {"key": cell.identifier})

    station = _get_or_create_station(session, cell.identifier)
    latest = session.scalar(select(func.max(Event.timestamp)).where(Event.station_id == station.id))

    if latest is not None and latest >= now - FRESH_WITHIN:
        session.commit()
        return station
    if latest is not None and _recently_attempted(cell.identifier, now):
        session.commit()
        return station

    start = (now - timedelta(days=BACKFILL_DAYS)).date() if latest is None else latest.date()
    try:
        hourly = nasa_power.fetch_hourly(cell, start, now.date())
    except nasa_power.NasaPowerError:
        session.rollback()
        if latest is None:
            raise
        return station

    measures = _get_or_create_measures(session, station)
    rows = [
        {"timestamp": moment, "station_id": station.id, "measure_id": measures[climate_measure.type].id,
         "measure_type": climate_measure.type, "value": climate_measure.format(values[climate_measure.nasa_parameter])}
        for moment, values in hourly.items()
        if latest is None or moment > latest
        for climate_measure in CLIMATE_MEASURES
    ]
    if rows:
        session.execute(insert(Event), rows)
    elif latest is None:
        session.rollback()
        raise nasa_power.NasaPowerError("A NASA ainda não tem dados para este local.")
    session.commit()
    return station
