"""Busca diária de umidade do solo na NASA POWER e grava em satellite_observation."""
import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.orm import Session

from saerpa_shared import nasa_power
from saerpa_shared.models import SatelliteObservation

DAILY_API_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
MISSING_VALUE = -999
REQUEST_TIMEOUT_SECONDS = 45
USER_AGENT = "saerpa-satellite/1.0"
SOURCE = "nasa_power"
PRODUCT = "MERRA-2"

UNIQUE_COLUMNS = [
    "source",
    "product",
    "variable",
    "observed_at",
    "cell_latitude",
    "cell_longitude",
]

@dataclass(frozen=True)
class SatelliteVariable:
    variable: str
    depth: str
    measurement_unit: str


POWER_VARIABLES = {
    "GWETTOP": SatelliteVariable("soil_moisture_surface", "surface", "adimensional_0_1"),
    "GWETROOT": SatelliteVariable("soil_moisture_root_zone", "0-100 cm", "adimensional_0_1"),
}


def fetch_daily(cell: nasa_power.GridCell, start: date, end: date) -> dict[date, dict[str, float]]:
    query = urllib.parse.urlencode({
        "parameters": ",".join(POWER_VARIABLES),
        "community": "AG",
        "latitude": cell.latitude,
        "longitude": cell.longitude,
        "start": start.strftime("%Y%m%d"),
        "end": end.strftime("%Y%m%d"),
        "format": "JSON",
        "time-standard": "UTC",
    })
    request = urllib.request.Request(f"{DAILY_API_URL}?{query}", headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            body = json.loads(response.read().decode("utf-8"))
        series_by_parameter = body["properties"]["parameter"]
    except urllib.error.HTTPError as error:
        raise nasa_power.NasaPowerError(f"A NASA POWER respondeu com erro {error.code}.") from error
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        raise nasa_power.NasaPowerError("Não foi possível falar com a NASA POWER.") from error
    except (ValueError, KeyError) as error:
        raise nasa_power.NasaPowerError("A NASA POWER devolveu uma resposta inesperada.") from error

    daily: dict[date, dict[str, float]] = {}
    for day_text in sorted(series_by_parameter[next(iter(POWER_VARIABLES))]):
        values = {parameter: series_by_parameter[parameter].get(day_text) for parameter in POWER_VARIABLES}
        if all(value is None or value == MISSING_VALUE for value in values.values()):
            continue
        day = datetime.strptime(day_text, "%Y%m%d").date()
        daily[day] = {parameter: values[parameter] for parameter in POWER_VARIABLES
                      if values[parameter] is not None and values[parameter] != MISSING_VALUE}
    return daily


def refresh_power_observations(
    session: Session,
    cell: nasa_power.GridCell,
    requested_latitude: float,
    requested_longitude: float,
    now: datetime | None = None,
    backfill_days: int = 365,
) -> int:
    now = now or datetime.now(timezone.utc)
    latest = session.scalar(
        select(func.max(SatelliteObservation.observed_at)).where(
            SatelliteObservation.source == SOURCE,
            SatelliteObservation.product == PRODUCT,
            SatelliteObservation.cell_latitude == cell.latitude,
            SatelliteObservation.cell_longitude == cell.longitude,
        )
    )
    start = (now - timedelta(days=backfill_days)).date() if latest is None else latest + timedelta(days=1)
    end = now.date() - timedelta(days=1)
    if start > end:
        return 0
    daily = fetch_daily(cell, start, end)

    rows = [
        {
            "source": SOURCE,
            "product": PRODUCT,
            "variable": satellite_variable.variable,
            "depth": satellite_variable.depth,
            "measurement_unit": satellite_variable.measurement_unit,
            "observed_at": day,
            "requested_latitude": requested_latitude,
            "requested_longitude": requested_longitude,
            "cell_latitude": cell.latitude,
            "cell_longitude": cell.longitude,
            "value": values.get(parameter),
            "quality_flag": None,
        }
        for day, values in daily.items()
        for parameter, satellite_variable in POWER_VARIABLES.items()
    ]
    if rows:
        statement = postgresql_insert(SatelliteObservation).on_conflict_do_nothing(index_elements=UNIQUE_COLUMNS)
        session.execute(statement, rows)
    session.commit()
    return len(rows)
