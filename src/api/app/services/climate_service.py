from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.exceptions import ExternalServiceError
from app.repositories import climate_repository
from saerpa_shared import climate, nasa_power
from saerpa_shared.schemas import (
    ClimateCellResponse,
    ClimateMetricResponse,
    ClimateResponse,
    DailyValueResponse,
    RainfallResponse,
)

WINDOW_DAYS = 30
SOURCE = "NASA POWER (MERRA-2)"


def _group_by_day(values: list[tuple[datetime, float]]) -> dict[date, list[float]]:
    grouped: dict[date, list[float]] = defaultdict(list)
    for timestamp, value in values:
        grouped[timestamp.astimezone(timezone.utc).date()].append(value)
    return grouped


def _build_metric(values: list[tuple[datetime, float]]) -> ClimateMetricResponse:
    grouped = _group_by_day(values)
    return ClimateMetricResponse(
        latest=values[-1][1],
        average=sum(value for _, value in values) / len(values),
        daily=[DailyValueResponse(date=day, value=sum(day_values) / len(day_values)) for day, day_values in sorted(grouped.items())],
    )


def _build_rainfall(values: list[tuple[datetime, float]], latest_moment: datetime) -> RainfallResponse:
    def total_since(hours: int) -> float:
        return sum(value for timestamp, value in values if timestamp > latest_moment - timedelta(hours=hours))

    return RainfallResponse(
        last_24_hours_millimeters=total_since(24),
        last_7_days_millimeters=total_since(24 * 7),
        last_30_days_millimeters=total_since(24 * WINDOW_DAYS),
        daily=[DailyValueResponse(date=day, value=sum(day_values)) for day, day_values in sorted(_group_by_day(values).items())],
    )


def get_climate(session: Session, lat: float, lng: float) -> ClimateResponse:
    cell = nasa_power.snap_to_grid_cell(lat, lng)
    try:
        station = climate.refresh_climate_events(session, cell)
    except nasa_power.NasaPowerError as error:
        raise ExternalServiceError(str(error)) from error

    latest_moment = climate_repository.get_latest_timestamp(session, station.id)
    since = latest_moment - timedelta(days=WINDOW_DAYS)
    values = {
        measure_type: climate_repository.list_values(session, station.id, measure_type, since)
        for measure_type in ("soil_moisture", "soil_temperature", "air_temperature", "air_humidity", "rainfall")
    }

    return ClimateResponse(
        source=SOURCE,
        cell=ClimateCellResponse(latitude=cell.latitude, longitude=cell.longitude, south=cell.south, west=cell.west, north=cell.north, east=cell.east),
        updated_through=latest_moment,
        soil_moisture_percent=_build_metric(values["soil_moisture"]),
        soil_temperature_celsius=_build_metric(values["soil_temperature"]),
        air_temperature_celsius=_build_metric(values["air_temperature"]),
        air_humidity_percent=_build_metric(values["air_humidity"]),
        rainfall=_build_rainfall(values["rainfall"], latest_moment),
    )
