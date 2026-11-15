"""
Baixa dados horários REAIS da NASA POWER (https://power.larc.nasa.gov) para um ponto
e grava uma cópia em data/nasa_power/, usada por simulate_sensor_events.py.

Variáveis (comunidade AG, hora UTC):
  T2M          temperatura do ar a 2 m (°C)
  RH2M         umidade relativa do ar a 2 m (%)
  PRECTOTCORR  precipitação corrigida (mm/hora)
  GWETTOP      umidade do solo na superfície, fração da saturação (0 a 1)
  TSOIL1       temperatura do solo, camada 1 (°C)

Os valores são de modelo (MERRA-2; a chuva é corrigida com observações), em grade de 0,5° x 0,625°:
representam a região, não o ponto exato do sensor.

Uso (dentro de src/shared):
  uv run python scripts/fetch_nasa_power.py --start 2026-11-07 --end 2026-11-13
"""
import argparse
import json
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

SHARED_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT_PATH = SHARED_ROOT / "data" / "nasa_power" / "navegantes_sc_hourly.json"
API_URL = "https://power.larc.nasa.gov/api/temporal/hourly/point"
PARAMETERS = ["T2M", "RH2M", "PRECTOTCORR", "GWETTOP", "TSOIL1"]
MISSING_VALUE = -999


def fetch(latitude: float, longitude: float, start: date, end: date) -> dict:
    query = urllib.parse.urlencode({
        "parameters": ",".join(PARAMETERS),
        "community": "AG",
        "latitude": latitude,
        "longitude": longitude,
        "start": start.strftime("%Y%m%d"),
        "end": end.strftime("%Y%m%d"),
        "format": "JSON",
        "time-standard": "UTC",
    })
    with urllib.request.urlopen(f"{API_URL}?{query}", timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def build_dataset(response: dict, location_name: str, latitude: float, longitude: float) -> dict:
    series_by_parameter = response["properties"]["parameter"]
    hours = sorted(series_by_parameter[PARAMETERS[0]])
    hourly = {}
    for hour in hours:
        row = {parameter: series_by_parameter[parameter][hour] for parameter in PARAMETERS}
        if MISSING_VALUE in row.values():
            raise SystemExit(f"A NASA ainda não publicou todos os valores para {hour}. Escolha um período mais antigo.")
        hourly[hour] = row

    return {
        "source": response["header"]["title"],
        "api_version": response["header"]["api"]["version"],
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "time_standard": "UTC",
        "location": {"name": location_name, "latitude": latitude, "longitude": longitude},
        "parameters": {
            parameter: {"units": details["units"], "long_name": details["longname"]}
            for parameter, details in response["parameters"].items()
        },
        "hourly": hourly,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Baixa dados horários reais da NASA POWER.")
    parser.add_argument("--start", type=date.fromisoformat, required=True)
    parser.add_argument("--end", type=date.fromisoformat, required=True)
    parser.add_argument("--latitude", type=float, default=-26.8943)
    parser.add_argument("--longitude", type=float, default=-48.6546)
    parser.add_argument("--location-name", default="Navegantes - SC (sede do município)")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_PATH)
    arguments = parser.parse_args()

    response = fetch(arguments.latitude, arguments.longitude, arguments.start, arguments.end)
    dataset = build_dataset(response, arguments.location_name, arguments.latitude, arguments.longitude)

    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    arguments.output.write_text(json.dumps(dataset, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(dataset['hourly'])} horas gravadas em {arguments.output}")


if __name__ == "__main__":
    main()
