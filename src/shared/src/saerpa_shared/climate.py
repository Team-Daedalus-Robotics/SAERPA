"""Grava dados reais da NASA POWER na tabela `event`, em uma estação virtual por célula da grade.

QUEM GRAVA: somente o nasa_event_worker (a API apenas lê `event` e registra em `climate_cell` quais
células foram pedidas). Cada célula (ver nasa_power.GridCell) vira uma estação
`nasa-power-lat<±lat>_lng<±lng>` com 5 medidas. Na primeira vez a célula recebe 30 dias; depois só
entra o que a NASA publicou de novo.
"""
import threading
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, insert, or_, select, text
from sqlalchemy.orm import Session

from saerpa_shared import nasa_power
from saerpa_shared.models import ClimateCell, Event, Measure, Station

BACKFILL_DAYS = 30
ACTIVE_FOR = timedelta(days=30)
REFRESH_EVERY = timedelta(hours=6)
RETRY_AFTER_ERROR = timedelta(seconds=60)
CELLS_PER_CYCLE = 3
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

CLIMATE_MEASURE_TYPES = tuple(climate_measure.type for climate_measure in CLIMATE_MEASURES)


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


def refresh_station_events(session: Session, cell: nasa_power.GridCell, now: datetime) -> int:
    """Busca na NASA o que falta da célula e grava em `event`; devolve quantos eventos entraram.

    Faz commit do que gravar. Levanta NasaPowerError se a NASA falhar ou ainda não tiver dados.
    """
    session.execute(text("select pg_advisory_xact_lock(hashtext(:key))"), {"key": cell.identifier})

    station = _get_or_create_station(session, cell.identifier)
    latest = session.scalar(select(func.max(Event.timestamp)).where(Event.station_id == station.id))
    start = (now - timedelta(days=BACKFILL_DAYS)).date() if latest is None else latest.date()

    try:
        hourly = nasa_power.fetch_hourly(cell, start, now.date())
    except nasa_power.NasaPowerError:
        session.rollback()
        raise

    measures = _get_or_create_measures(session, station)
    rows = [
        {"timestamp": moment, "station_id": station.id, "measure_id": measures[climate_measure.type].id,
         "measure_type": climate_measure.type, "value": climate_measure.format(values[climate_measure.nasa_parameter])}
        for moment, values in hourly.items()
        if latest is None or moment > latest
        for climate_measure in CLIMATE_MEASURES
    ]
    if not rows and latest is None:
        session.rollback()
        raise nasa_power.NasaPowerError("A NASA ainda não tem dados para este local.")
    if rows:
        session.execute(insert(Event), rows)
    session.commit()
    return len(rows)


def find_cells_to_refresh(session: Session, now: datetime, limit: int = CELLS_PER_CYCLE) -> list[ClimateCell]:
    """Células pedidas recentemente que ainda não têm dados ou estão desatualizadas (e não falharam há pouco)."""
    statement = (
        select(ClimateCell)
        .where(
            ClimateCell.deleted.is_(False),
            ClimateCell.last_requested_at >= now - ACTIVE_FOR,
            or_(ClimateCell.last_refreshed_at.is_(None), ClimateCell.last_refreshed_at <= now - REFRESH_EVERY),
            or_(ClimateCell.last_error.is_(None), ClimateCell.last_attempt_at <= now - RETRY_AFTER_ERROR),
        )
        .order_by(ClimateCell.last_refreshed_at.asc().nulls_first(), ClimateCell.last_requested_at.desc())
        .limit(limit)
    )
    return list(session.scalars(statement).all())


def process_pending_cells(
    session_factory: Callable[[], Session], now: datetime | None = None, limit: int = CELLS_PER_CYCLE,
) -> list[tuple[str, int | None, str | None]]:
    """Um ciclo do nasa_event_worker: atualiza as células pendentes. Devolve (identificador, eventos novos, erro)."""
    now = now or datetime.now(timezone.utc)
    with session_factory() as session:
        pending = [(climate_cell.id, nasa_power.GridCell(climate_cell.latitude, climate_cell.longitude))
                   for climate_cell in find_cells_to_refresh(session, now, limit)]

    results = []
    for climate_cell_id, cell in pending:
        with session_factory() as session:
            try:
                inserted = refresh_station_events(session, cell, now)
                error = None
            except nasa_power.NasaPowerError as exception:
                inserted, error = None, str(exception)
            climate_cell = session.get(ClimateCell, climate_cell_id)
            climate_cell.last_attempt_at = now
            if error is None:
                climate_cell.last_refreshed_at = now
            climate_cell.last_error = error
            session.commit()
        results.append((cell.identifier, inserted, error))
    return results
