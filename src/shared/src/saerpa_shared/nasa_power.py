"""Cliente mínimo da API NASA POWER (dados horários) e da grade MERRA-2.

Os valores da NASA POWER são de modelo, em células de 0,5° de latitude por 0,625° de longitude
(cerca de 55 x 66 km no sul do Brasil). Qualquer ponto dentro da célula recebe os mesmos valores,
por isso as consultas são sempre feitas no CENTRO da célula (e a localização exata do usuário
nunca é enviada à NASA).
"""
import json
import math
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import date, datetime, timezone

API_URL = "https://power.larc.nasa.gov/api/temporal/hourly/point"
PARAMETERS = ("T2M", "RH2M", "PRECTOTCORR", "GWETTOP", "TSOIL1")
GRID_LATITUDE_STEP = 0.5
GRID_LONGITUDE_STEP = 0.625
MISSING_VALUE = -999
REQUEST_TIMEOUT_SECONDS = 45
USER_AGENT = "saerpa-climate/1.0"


class NasaPowerError(Exception):
    """A NASA POWER não respondeu ou devolveu algo inesperado."""


@dataclass(frozen=True)
class GridCell:
    latitude: float
    longitude: float

    @property
    def south(self) -> float:
        return self.latitude - GRID_LATITUDE_STEP / 2

    @property
    def north(self) -> float:
        return self.latitude + GRID_LATITUDE_STEP / 2

    @property
    def west(self) -> float:
        return self.longitude - GRID_LONGITUDE_STEP / 2

    @property
    def east(self) -> float:
        return self.longitude + GRID_LONGITUDE_STEP / 2

    @property
    def identifier(self) -> str:
        return f"nasa-power-lat{self.latitude:+.2f}_lng{self.longitude:+.4f}"


def snap_to_grid_cell(latitude: float, longitude: float) -> GridCell:
    """Célula da grade MERRA-2 que contém o ponto (o centro é o múltiplo de 0,5 / 0,625 mais próximo)."""
    center_latitude = round(latitude / GRID_LATITUDE_STEP) * GRID_LATITUDE_STEP + 0.0
    center_longitude = round(longitude / GRID_LONGITUDE_STEP) * GRID_LONGITUDE_STEP + 0.0
    return GridCell(round(center_latitude, 4), round(center_longitude, 4))


def fetch_hourly(cell: GridCell, start: date, end: date) -> dict[datetime, dict[str, float]]:
    """Valores horários (UTC) da célula; horas que a NASA ainda não publicou são omitidas."""
    query = urllib.parse.urlencode({
        "parameters": ",".join(PARAMETERS),
        "community": "AG",
        "latitude": cell.latitude,
        "longitude": cell.longitude,
        "start": start.strftime("%Y%m%d"),
        "end": end.strftime("%Y%m%d"),
        "format": "JSON",
        "time-standard": "UTC",
    })
    request = urllib.request.Request(f"{API_URL}?{query}", headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            body = json.loads(response.read().decode("utf-8"))
        series_by_parameter = body["properties"]["parameter"]
    except urllib.error.HTTPError as error:
        raise NasaPowerError(f"A NASA POWER respondeu com erro {error.code}.") from error
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        raise NasaPowerError("Não foi possível falar com a NASA POWER.") from error
    except (ValueError, KeyError) as error:
        raise NasaPowerError("A NASA POWER devolveu uma resposta inesperada.") from error

    hourly: dict[datetime, dict[str, float]] = {}
    for hour in sorted(series_by_parameter[PARAMETERS[0]]):
        row = {parameter: series_by_parameter[parameter][hour] for parameter in PARAMETERS}
        if MISSING_VALUE in row.values():
            continue
        hourly[datetime.strptime(hour, "%Y%m%d%H").replace(tzinfo=timezone.utc)] = row
    return hourly
