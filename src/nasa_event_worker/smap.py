"""Busca de umidade do solo pelo SMAP (AppEEARS) e gravação em satellite_observation.

Backfill de até 1 ano em batches semanais, gravando 1 amostra por dia
(média das passadas AM e PM) com variable "soil_moisture".
"""
import csv
import io
import json
import os
import time
import urllib.error
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
VARIABLE = "soil_moisture"
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
    print(f"[diag] AppEEARS: autenticando usuário {os.environ['EARTHDATA_USER']}...", flush=True)
    body = json.loads(_request(f"{APPEEARS_URL}/login", headers=headers, method="POST")) # pyright: ignore[reportArgumentType]
    print("[diag] AppEEARS: token obtido.", flush=True)
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
    task_start, task_end = start, end
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
    body_response = json.loads(_request(f"{APPEEARS_URL}/task", headers=headers, body=body, method="POST")) # pyright: ignore[reportArgumentType]
    task_id = body_response["task_id"]
    print(
        f"[diag] AppEEARS: tarefa {task_id} submetida "
        f"({task_start} a {task_end}, {len(layers)} camadas, ponto {latitude:.4f},{longitude:.4f}).",
        flush=True,
    )
    return task_id


def _wait_task(headers: dict[str, str], task_id: str) -> None:
    for attempt in range(TASK_MAX_POLLS):
        time.sleep(TASK_POLL_SECONDS)
        status = json.loads(_request(f"{APPEEARS_URL}/task/{task_id}", headers=headers)) # pyright: ignore[reportArgumentType]
        print(f"[diag] AppEEARS: tarefa {task_id} tentativa {attempt + 1}/{TASK_MAX_POLLS}: {status.get('status')}.", flush=True)
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
    print(f"[diag] AppEEARS: baixando {target['file_name']}...", flush=True)
    text = _request(f"{APPEEARS_URL}/bundle/{task_id}/{target['file_id']}", headers=headers,
                    timeout=DOWNLOAD_TIMEOUT_SECONDS) # type: ignore
    print(f"[diag] AppEEARS: download concluído ({len(text)} caracteres).", flush=True) # type: ignore
    return text # type: ignore


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
            SatelliteObservation.variable == VARIABLE,
            SatelliteObservation.cell_latitude == latitude,
            SatelliteObservation.cell_longitude == longitude,
        )
    )
    horizon = (now - timedelta(days=backfill_days)).date()
    end = now.date() - timedelta(days=1)

    print(
        f"[diag] SMAP {latitude:.4f},{longitude:.4f}: último registro={latest}, "
        f"horizonte={horizon}, fim={end}.",
        flush=True,
    )
    headers = _login()
    layers = _discover_layers(headers)
    print(f"[diag] SMAP: camadas descobertas: {sorted(layers.values())}.", flush=True)
    soil_columns = {name: key for key, name in layers.items() if not key.endswith("_qual")}

    total = 0
    while True:
        start = end - timedelta(days=6)
        if latest is not None and start <= latest:
            print("[diag] SMAP: histórico já coberto; nada a buscar.", flush=True)
            break
        if latest is None and start < horizon:
            print(f"[diag] SMAP: horizonte de {backfill_days} dias alcançado.", flush=True)
            break
        try:
            task_id = _submit_task(headers, layers, latitude, longitude, max(start, horizon), end)
            _wait_task(headers, task_id)
            text = _download_results(headers, task_id)
            rows = _parse_results(text, soil_columns, layers, latitude, longitude)
            print(f"[diag] SMAP: {len(rows)} linhas interpretadas do CSV.", flush=True)
            if not rows:
                print(
                    "[diag] SMAP: nenhuma linha após o filtro de célula — "
                    "verifique se o ponto cai numa passada do SMAP (sem pixels).",
                    flush=True,
                )
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
    values_by_day: dict[date, list[tuple[float, int | None]]] = {}
    for record in csv.DictReader(io.StringIO(text)):
        row_latitude = float(record["Latitude"])
        row_longitude = float(record["Longitude"])
        if row_latitude != latitude or row_longitude != longitude:
            continue
        observed_at = _parse_date(record["Date"])
        for column in soil_columns:
            csv_column = next((c for c in record if c.endswith(column)), None)
            if csv_column is None or record[csv_column] == "":
                continue
            value = float(record[csv_column])
            if value == FILL_VALUE:
                continue
            quality_key = f"{soil_columns[column]}_qual"
            quality_column = next((c for c in record if c.endswith(layers[quality_key])), None) \
                if quality_key in layers else None
            quality_flag = int(float(record[quality_column])) if quality_column and record[quality_column] else None
            values_by_day.setdefault(observed_at, []).append((value, quality_flag))
    rows = []
    for observed_at, samples in sorted(values_by_day.items()):
        value = sum(sample[0] for sample in samples) / len(samples)
        flags = [sample[1] for sample in samples if sample[1] is not None]
        rows.append({
            "source": SOURCE,
            "product": PRODUCT,
            "variable": VARIABLE,
            "depth": DEPTH,
            "measurement_unit": MEASUREMENT_UNIT,
            "observed_at": observed_at,
            "requested_latitude": latitude,
            "requested_longitude": longitude,
            "cell_latitude": latitude,
            "cell_longitude": longitude,
            "value": value,
            "quality_flag": max(flags) if flags else None,
        })
    return rows
