"""Busca de umidade do solo pelo SMAP (AppEEARS) e gravação em satellite_observation."""
import csv
import io
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.orm import Session

from saerpa_shared.models import SatelliteObservation

APPEEARS_URL = "https://appeears.earthdatacloud.nasa.gov/api"
PRODUCT = "SPL3SMP_E.006"
FILL_VALUE = -9999.0
TASK_POLL_SECONDS = 30
TASK_MAX_POLLS = 60
REQUEST_TIMEOUT_SECONDS = 60
DOWNLOAD_TIMEOUT_SECONDS = 300
SOURCE = "smap"
DEPTH = "0-5 cm"
MEASUREMENT_UNIT = "m3_m3"

UNIQUE_COLUMNS = [
    "source",
    "product",
    "variable",
    "observed_at",
    "cell_latitude",
    "cell_longitude",
]


class SmapError(Exception):
    """O AppEEARS falhou em alguma etapa da tarefa."""


def _request(url: str, headers: dict[str, str] | None = None, body: dict | None = None,
             method: str = "GET", timeout: int = REQUEST_TIMEOUT_SECONDS) -> object:
    data = json.dumps(body).encode("utf-8") if body is not None else (b"" if method != "GET" else None)
    headers = dict(headers or {})
    if data is not None and "Content-Type" not in {key.title() for key in headers} and body is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            content = response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        raise SmapError(f"O AppEEARS respondeu com erro {error.code}.") from error
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        raise SmapError("Não foi possível falar com o AppEEARS.") from error
    return content


def _login() -> dict[str, str]:
    credentials = f"{os.environ['EARTHDATA_USER']}:{os.environ['EARTHDATA_PASS']}"
    encoded = credentials.encode("utf-8")
    import base64
    headers = {"Authorization": "Basic " + base64.b64encode(encoded).decode("ascii")}
    body = json.loads(_request(f"{APPEEARS_URL}/login", headers=headers, method="POST")) # pyright: ignore[reportArgumentType]
    return {"Authorization": f"Bearer {body['token']}"}


def _discover_layers(headers: dict[str, str]) -> dict[str, str]:
    catalog = json.loads(_request(f"{APPEEARS_URL}/product/{PRODUCT}", headers=headers)) # type: ignore
    layers: dict[str, str] = {}
    quality: dict[str, str] = {}
    for name in catalog:
        lowered = name.lower()
        if "error" in lowered or "dielectric" in lowered:
            continue
        if lowered.endswith("am_soil_moisture"):
            layers["soil_moisture_am"] = name
        elif lowered.endswith("soil_moisture_pm"):
            layers["soil_moisture_pm"] = name
        elif lowered.endswith("retrieval_qual_flag_am"):
            quality["soil_moisture_am"] = name
        elif lowered.endswith("retrieval_qual_flag_pm"):
            quality["soil_moisture_pm"] = name
    if not layers:
        raise SmapError(f"Nenhuma camada de umidade do solo encontrada em {PRODUCT}.")
    return {**layers, **{f"{key}_qual": name for key, name in quality.items()}}


def _submit_task(headers: dict[str, str], layers: dict[str, str],
                 latitude: float, longitude: float, start: date, end: date) -> str:
    body = {
        "task_type": "point",
        "task_name": f"saerpa_smap_{int(time.time())}",
        "params": {
            "dates": [{
                "startDate": start.strftime("%m-%d-%Y"),
                "endDate": end.strftime("%m-%d-%Y"),
            }],
            "layers": [{"product": PRODUCT, "layer": name} for name in layers.values()],
            "coordinates": [{"id": "p0", "latitude": latitude, "longitude": longitude, "category": "saerpa"}],
        },
    }
    body_response = json.loads(_request(f"{APPEEARS_URL}/task", headers=headers, body=body, method="POST"))
    return body_response["task_id"]


def _wait_task(headers: dict[str, str], task_id: str) -> None:
    for _ in range(TASK_MAX_POLLS):
        time.sleep(TASK_POLL_SECONDS)
        status = json.loads(_request(f"{APPEEARS_URL}/task/{task_id}", headers=headers)) # pyright: ignore[reportArgumentType]
        if status.get("status") == "done":
            return
        if status.get("status") in ("error", "failed"):
            raise SmapError(f"A tarefa AppEEARS falhou: {status}.")
    raise SmapError("O AppEEARS demorou demais para concluir a tarefa.")


def _download_results(headers: dict[str, str], task_id: str) -> str:
    bundle = json.loads(_request(f"{APPEEARS_URL}/bundle/{task_id}", headers=headers)) # pyright: ignore[reportArgumentType]
    target = next(
        (item for item in bundle["files"] if item["file_name"].lower().endswith("results.csv")),
        None,
    )
    if target is None:
        raise SmapError("O resultado da tarefa não contém results.csv.")
    return _request(f"{APPEEARS_URL}/bundle/{task_id}/{target['file_id']}", headers=headers,
                    timeout=DOWNLOAD_TIMEOUT_SECONDS) # type: ignore


def _parse_date(value: str) -> date:
    for fmt in ("%Y-%m-%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(value[:10], fmt).date()
        except ValueError:
            continue
    raise SmapError(f"Data inesperada no CSV do AppEEARS: {value!r}.")


def refresh_smap_observations(session: Session, latitude: float, longitude: float,
                              now: datetime | None = None, backfill_days: int = 365) -> int:
    now = now or datetime.now(timezone.utc)
    latest = session.scalar(
        select(func.max(SatelliteObservation.observed_at)).where(
            SatelliteObservation.source == SOURCE,
            SatelliteObservation.product == PRODUCT,
            SatelliteObservation.cell_latitude == latitude,
            SatelliteObservation.cell_longitude == longitude,
        )
    )
    horizon = (now - timedelta(days=backfill_days)).date()
    end = now.date() - timedelta(days=1)

    headers = _login()
    layers = _discover_layers(headers)
    soil_columns = {name: key for key, name in layers.items() if not key.endswith("_qual")}

    total = 0
    while True:
        start = end - timedelta(days=6)
        if latest is not None and start <= latest:
            break
        if latest is None and start < horizon:
            break
        try:
            task_id = _submit_task(headers, layers, latitude, longitude, max(start, horizon), end)
            _wait_task(headers, task_id)
            text = _download_results(headers, task_id)
            rows = _parse_results(text, soil_columns, layers, latitude, longitude)
            if rows:
                statement = postgresql_insert(SatelliteObservation).on_conflict_do_nothing(
                    index_elements=UNIQUE_COLUMNS)
                session.execute(statement, rows)
            session.commit()
            total += len(rows)
        except SmapError:
            session.commit()
            raise
        end = start - timedelta(days=1)
    return total


def _parse_results(text: str, soil_columns: dict[str, str], layers: dict[str, str],
                   latitude: float, longitude: float) -> list[dict]:
    rows = []
    for record in csv.DictReader(io.StringIO(text)):
        observed_at = _parse_date(record["Date"])
        row_latitude = float(record["Latitude"])
        row_longitude = float(record["Longitude"])
        for column, key in soil_columns.items():
            csv_column = next((c for c in record if c.endswith(column)), None)
            if csv_column is None or record[csv_column] == "":
                continue
            value = float(record[csv_column])
            quality_key = f"{key}_qual"
            quality_column = next((c for c in record if c.endswith(layers[quality_key])), None) \
                if quality_key in layers else None
            rows.append({
                "source": SOURCE,
                "product": PRODUCT,
                "variable": key,
                "depth": DEPTH,
                "measurement_unit": MEASUREMENT_UNIT,
                "observed_at": observed_at,
                "requested_latitude": latitude,
                "requested_longitude": longitude,
                "cell_latitude": row_latitude,
                "cell_longitude": row_longitude,
                "value": None if value == FILL_VALUE else value,
                "quality_flag": int(float(record[quality_column])) if quality_column and record[quality_column] else None,
            })
    return [row for row in rows if row["cell_latitude"] == latitude and row["cell_longitude"] == longitude]
