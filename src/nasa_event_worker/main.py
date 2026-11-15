import os
import time

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from saerpa_shared import climate, nasa_power
from saerpa_shared.engine import SessionLocal
from saerpa_shared.models import Property

import power as power_module
import smap as smap_module

POLL_SECONDS = int(os.environ.get("NASA_EVENT_POLL_SECONDS", "900"))
CLIMATE_POLL_SECONDS = float(os.environ.get("CLIMATE_POLL_SECONDS", "3"))
BACKFILL_DAYS = int(os.environ.get("NASA_EVENT_BACKFILL_DAYS", "365"))
HAS_EARTHDATA_CREDENTIALS = bool(os.environ.get("EARTHDATA_USER") and os.environ.get("EARTHDATA_PASS"))


def load_properties() -> list[tuple[float, float]]:
    with SessionLocal() as session:
        rows = session.execute(
            select(Property.lat, Property.lng).where(Property.deleted == False).distinct()  # noqa: E712
        ).all()
    return list(rows)


def refresh_power(latitude: float, longitude: float) -> None:
    cell = nasa_power.snap_to_grid_cell(latitude, longitude)
    with SessionLocal() as session:
        count = power_module.refresh_power_observations(session, cell, latitude, longitude, backfill_days=BACKFILL_DAYS)
    print(f"POWER {cell.identifier}: {count} registros de umidade do solo gravados.", flush=True)


def refresh_smap(latitude: float, longitude: float) -> None:
    with SessionLocal() as session:
        count = smap_module.refresh_smap_observations(session, latitude, longitude, backfill_days=BACKFILL_DAYS)
    print(f"SMAP {latitude:.4f},{longitude:.4f}: {count} registros de umidade do solo gravados.", flush=True)


def refresh_location(latitude: float, longitude: float) -> None:
    refresh_power(latitude, longitude)
    if HAS_EARTHDATA_CREDENTIALS:
        try:
            refresh_smap(latitude, longitude)
        except smap_module.SmapError as error:
            print(f"SMAP {latitude:.4f},{longitude:.4f} indisponível: {error}", flush=True)


def refresh_satellite_observations() -> None:
    for latitude, longitude in load_properties():
        try:
            refresh_location(latitude, longitude)
        except nasa_power.NasaPowerError as error:
            print(f"POWER {latitude:.4f},{longitude:.4f} indisponível: {error}", flush=True)


def refresh_climate_events() -> None:
    for identifier, inserted, error in climate.process_pending_cells(SessionLocal):
        if error is None:
            print(f"{identifier}: {inserted} eventos novos da NASA.", flush=True)
        else:
            print(f"{identifier}: falhou ({error}); tenta de novo em {int(climate.RETRY_AFTER_ERROR.total_seconds())} s.", flush=True)


print("nasa_event_worker iniciado.", flush=True)

next_satellite_cycle = 0.0
waiting_for_database = False
while True:
    try:
        refresh_climate_events()
        if time.monotonic() >= next_satellite_cycle:
            refresh_satellite_observations()
            next_satellite_cycle = time.monotonic() + POLL_SECONDS
        waiting_for_database = False
    except SQLAlchemyError as error:
        if not waiting_for_database:
            print(f"Banco ainda não está pronto (as migrations são aplicadas pela API): {type(error).__name__}", flush=True)
        waiting_for_database = True
    except Exception as error:
        print(f"Ciclo do nasa_event_worker falhou: {error}", flush=True)
    time.sleep(CLIMATE_POLL_SECONDS)
