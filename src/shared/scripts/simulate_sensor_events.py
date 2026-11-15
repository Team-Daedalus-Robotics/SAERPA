"""
Simula o que os sensores da estação enviariam e grava as leituras na tabela `event`.

Base: dados REAIS da NASA POWER (data/nasa_power/*.json, baixados por fetch_nasa_power.py).
Os valores da NASA são interpolados a cada intervalo de leitura e transformados no que cada
modelo de sensor produz de fato (faixa, resolução, erro, ruído e falhas):

  Capacitive Soil Moisture Sensor v2.0  saída analógica lida pelo ADC de 12 bits da placa
                                        (Heltec LoRa 32 V3); a firmware converte para %
  DHT11                                 temperatura 0-50 °C (resolução 1 °C, erro ±2 °C) e
                                        umidade do ar 20-90 % (resolução 1 %, erro ±5 %)
  DS18B20                               sonda à prova d'água, -55 a 125 °C, resolução de
                                        12 bits = 0,0625 °C, erro ±0,5 °C
  chuva                                 não há sensor: entra o valor REAL da NASA (PRECTOTCORR, mm/h),
                                        uma leitura por hora, sem perda de pacote

Premissas (ajuste as constantes abaixo se medirem diferente em campo):
  - a calibração do sensor de umidade (ADC seco/molhado) é típica, não medida;
  - a sonda DS18B20 está enterrada no solo (temperatura do solo);
  - os valores da NASA são de modelo, em grade de ~50 km: representam a região;
  - cerca de 1,5 % dos pacotes LoRa se perdem e cerca de 1 % das leituras do DHT11 falham.

Os pacotes são enviados ao station_data_gateway (POST /api/stations/data), o mesmo caminho de um sensor
real: é o gateway que cria a estação, as medidas e grava os eventos. Ele não apaga nem confere duplicatas,
então rodar duas vezes duplica as leituras (o script avisa e recusa, a menos que se use --force).

Uso (dentro de src/shared):
  uv run python scripts/simulate_sensor_events.py --gateway-url http://localhost:PORTA
      (a porta do `station-data-gateway` aparece no painel do Aspire; também vale a variável
       de ambiente STATION_DATA_GATEWAY_URL. Se o endereço for https com certificado de
       desenvolvimento, acrescente --insecure.)
  uv run python scripts/simulate_sensor_events.py --dry-run                   # só mostra o resumo
  uv run python scripts/simulate_sensor_events.py --payloads-out saida.json   # grava os pacotes em arquivo
  uv run python scripts/simulate_sensor_events.py --direct-database           # SÓ PARA TESTES: grava direto no banco
"""
import argparse
import json
import math
import os
import random
import ssl
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

SHARED_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_NASA_PATH = SHARED_ROOT / "data" / "nasa_power" / "navegantes_sc_hourly.json"

STATION_UNIQUE_IDENTIFIER = "sim-navegantes-001"
DATA_TYPE = "number"

GATEWAY_PATH = "/api/stations/data"
GATEWAY_URL_ENVIRONMENT_VARIABLE = "STATION_DATA_GATEWAY_URL"
GATEWAY_TIMEOUT_SECONDS = 30
PROGRESS_EVERY = 200

# Capacitive Soil Moisture Sensor v2.0 em ADC de 12 bits (0-4095), calibração típica
ADC_RAW_DRY = 3100
ADC_RAW_WET = 1400
ADC_MAXIMUM = 4095
ADC_NOISE_STANDARD_DEVIATION = 12
RAIN_BUMP_GAIN = 1.5
RAIN_BUMP_DECAY_HOURS = 2.0
RAIN_BUMP_MAXIMUM_PERCENT = 4.0
RAIN_MEMORY_HOURS = 6

DHT11_TEMPERATURE_RANGE = (0, 50)
DHT11_HUMIDITY_RANGE = (20, 90)
DHT11_TEMPERATURE_OFFSET_STANDARD_DEVIATION = 0.6
DHT11_HUMIDITY_OFFSET_STANDARD_DEVIATION = 2.0
DHT11_READ_FAILURE_PROBABILITY = 0.01

DS18B20_RESOLUTION = 0.0625
DS18B20_OFFSET_STANDARD_DEVIATION = 0.15

PACKET_LOSS_PROBABILITY = 0.015


@dataclass(frozen=True)
class SensorSpecification:
    type: str
    sensor_name: str
    measurement_unit: str


SOIL_MOISTURE = SensorSpecification("soil_moisture", "Capacitive Soil Moisture Sensor v2.0", "%")
AIR_TEMPERATURE = SensorSpecification("air_temperature", "DHT11", "°C")
AIR_HUMIDITY = SensorSpecification("air_humidity", "DHT11", "%")
SOIL_TEMPERATURE = SensorSpecification("soil_temperature", "DS18B20", "°C")
RAINFALL = SensorSpecification("rainfall", "NASA POWER PRECTOTCORR", "mm/h")
SENSORS = [SOIL_MOISTURE, AIR_TEMPERATURE, AIR_HUMIDITY, SOIL_TEMPERATURE, RAINFALL]


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


class NasaSeries:
    """Série horária da NASA com interpolação linear entre as horas."""

    def __init__(self, dataset: dict):
        self.values = {
            datetime.strptime(hour, "%Y%m%d%H").replace(tzinfo=timezone.utc): row
            for hour, row in dataset["hourly"].items()
        }
        self.hours = sorted(self.values)

    @property
    def first_moment(self) -> datetime:
        return self.hours[0]

    @property
    def last_moment(self) -> datetime:
        return self.hours[-1]

    def interpolate(self, parameter: str, moment: datetime) -> float:
        hour = moment.replace(minute=0, second=0, microsecond=0)
        if hour >= self.last_moment:
            return self.values[self.last_moment][parameter]
        fraction = (moment - hour).total_seconds() / 3600
        return self.values[hour][parameter] * (1 - fraction) + self.values[hour + timedelta(hours=1)][parameter] * fraction

    def rain_bump_percent(self, moment: datetime) -> float:
        hour = moment.replace(minute=0, second=0, microsecond=0)
        bump = 0.0
        for hours_ago in range(RAIN_MEMORY_HOURS + 1):
            row = self.values.get(hour - timedelta(hours=hours_ago))
            if row:
                bump += row["PRECTOTCORR"] * RAIN_BUMP_GAIN * math.exp(-hours_ago / RAIN_BUMP_DECAY_HOURS)
        return min(bump, RAIN_BUMP_MAXIMUM_PERCENT)


class SimulatedStation:
    def __init__(self, series: NasaSeries, seed: int):
        self.series = series
        self.random = random.Random(seed)
        self.dht11_temperature_offset = self.random.gauss(0, DHT11_TEMPERATURE_OFFSET_STANDARD_DEVIATION)
        self.dht11_humidity_offset = self.random.gauss(0, DHT11_HUMIDITY_OFFSET_STANDARD_DEVIATION)
        self.ds18b20_offset = self.random.gauss(0, DS18B20_OFFSET_STANDARD_DEVIATION)
        self.moisture_adc_offset = self.random.gauss(0, 25)

    def read_soil_moisture(self, moment: datetime) -> str:
        true_percent = clamp(self.series.interpolate("GWETTOP", moment) * 100 + self.series.rain_bump_percent(moment), 0, 100)
        raw = ADC_RAW_DRY - (ADC_RAW_DRY - ADC_RAW_WET) * true_percent / 100
        raw = round(clamp(raw + self.moisture_adc_offset + self.random.gauss(0, ADC_NOISE_STANDARD_DEVIATION), 0, ADC_MAXIMUM))
        percent = clamp((ADC_RAW_DRY - raw) / (ADC_RAW_DRY - ADC_RAW_WET) * 100, 0, 100)
        return f"{percent:.1f}"

    def read_air_temperature(self, moment: datetime) -> str:
        celsius = self.series.interpolate("T2M", moment) + self.dht11_temperature_offset + self.random.gauss(0, 0.3)
        return str(round(clamp(celsius, *DHT11_TEMPERATURE_RANGE)))

    def read_air_humidity(self, moment: datetime) -> str:
        percent = self.series.interpolate("RH2M", moment) + self.dht11_humidity_offset + self.random.gauss(0, 1.0)
        return str(round(clamp(percent, *DHT11_HUMIDITY_RANGE)))

    def read_soil_temperature(self, moment: datetime) -> str:
        celsius = self.series.interpolate("TSOIL1", moment) + self.ds18b20_offset + self.random.gauss(0, 0.03)
        quantized = round(celsius / DS18B20_RESOLUTION) * DS18B20_RESOLUTION
        return f"{quantized:.4f}"

    def build_payload(self, moment: datetime) -> dict | None:
        """Pacote no formato do gateway (POST /api/stations/data); None quando o pacote LoRa se perde."""
        if self.random.random() < PACKET_LOSS_PROBABILITY:
            return None

        readings = [(SOIL_MOISTURE, self.read_soil_moisture(moment)), (SOIL_TEMPERATURE, self.read_soil_temperature(moment))]
        if self.random.random() >= DHT11_READ_FAILURE_PROBABILITY:
            readings += [(AIR_TEMPERATURE, self.read_air_temperature(moment)), (AIR_HUMIDITY, self.read_air_humidity(moment))]

        return {
            "unique_identifier": STATION_UNIQUE_IDENTIFIER,
            "timestamp": int(moment.timestamp()),
            "measures": [
                {"type": sensor.type, "sensor_name": sensor.sensor_name, "measurement_unit": sensor.measurement_unit, "value": value}
                for sensor, value in readings
            ],
        }


def build_payloads(dataset: dict, interval_minutes: int, seed: int) -> list[dict]:
    series = NasaSeries(dataset)
    station = SimulatedStation(series, seed)
    payloads = []
    moment = series.first_moment
    while moment <= series.last_moment:
        payload = station.build_payload(moment)
        if moment.minute == 0:
            if payload is None:
                payload = {"unique_identifier": STATION_UNIQUE_IDENTIFIER, "timestamp": int(moment.timestamp()), "measures": []}
            payload["measures"].append({
                "type": RAINFALL.type, "sensor_name": RAINFALL.sensor_name, "measurement_unit": RAINFALL.measurement_unit,
                "value": f"{series.values[moment]['PRECTOTCORR']:.2f}",
            })
        if payload is not None:
            payloads.append(payload)
        moment += timedelta(minutes=interval_minutes)
    return payloads


def print_summary(payloads: list[dict], expected_packets: int) -> None:
    print(f"pacotes: {len(payloads)} de {expected_packets} previstos")
    values_by_type: dict[str, list[float]] = {}
    for payload in payloads:
        for measure in payload["measures"]:
            values_by_type.setdefault(measure["type"], []).append(float(measure["value"]))
    for sensor in SENSORS:
        values = values_by_type.get(sensor.type, [])
        print(f"  {sensor.type:17s} {sensor.sensor_name:38s} leituras {len(values):5d}  "
              f"min {min(values):8.3f}  máx {max(values):8.3f}  média {sum(values) / len(values):8.3f} {sensor.measurement_unit}")
    print(f"eventos no total: {sum(len(values) for values in values_by_type.values())}")


def count_existing_events() -> int | None:
    """Eventos já gravados na estação simulada (só leitura); None quando não há DATABASE_URL para consultar."""
    if not os.environ.get("DATABASE_URL"):
        return None

    from sqlalchemy import func, select

    from saerpa_shared.engine import SessionLocal
    from saerpa_shared.models import Event, Station

    with SessionLocal() as session:
        return session.scalar(
            select(func.count(Event.id)).join(Station, Station.id == Event.station_id)
            .where(Station.unique_identifier == STATION_UNIQUE_IDENTIFIER)
        )


def send_to_gateway(payloads: list[dict], gateway_url: str, insecure: bool) -> None:
    """Envia os pacotes em ordem, um por vez (o gateway cria estação e medidas na primeira leitura, sem trava)."""
    endpoint = gateway_url.rstrip("/") + GATEWAY_PATH
    context = ssl._create_unverified_context() if insecure else None
    for sent, payload in enumerate(payloads):
        request = urllib.request.Request(
            endpoint, data=json.dumps(payload).encode("utf-8"), method="POST", headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=GATEWAY_TIMEOUT_SECONDS, context=context) as response:
                if response.status != 201:
                    raise SystemExit(f"O gateway respondeu {response.status} no pacote {sent + 1}. {sent} pacotes já foram gravados.")
        except urllib.error.HTTPError as error:
            raise SystemExit(f"O gateway recusou o pacote {sent + 1} (HTTP {error.code}): {error.read().decode('utf-8', 'replace')[:200]}\n"
                             f"{sent} pacotes já foram gravados; não envie de novo sem apagar a estação '{STATION_UNIQUE_IDENTIFIER}'.") from error
        except (urllib.error.URLError, OSError) as error:
            raise SystemExit(f"Não foi possível falar com o gateway em {endpoint}: {error}\n"
                             f"{sent} pacotes já foram gravados.") from error
        if (sent + 1) % PROGRESS_EVERY == 0:
            print(f"  {sent + 1} de {len(payloads)} pacotes enviados")
    print(f"{len(payloads)} pacotes enviados ao gateway ({endpoint})")


def load_into_database(payloads: list[dict], replace: bool) -> None:
    from sqlalchemy import delete, insert, select

    from saerpa_shared.engine import SessionLocal
    from saerpa_shared.models import Event, Measure, Station

    with SessionLocal.begin() as session:
        station = session.scalar(select(Station).where(Station.unique_identifier == STATION_UNIQUE_IDENTIFIER))
        if station is None:
            station = Station(unique_identifier=STATION_UNIQUE_IDENTIFIER)
            session.add(station)
            session.flush()

        measure_by_key: dict[tuple[str, str], Measure] = {}
        for sensor in SENSORS:
            measure = session.scalar(select(Measure).where(
                Measure.station_id == station.id, Measure.type == sensor.type, Measure.sensor_name == sensor.sensor_name))
            if measure is None:
                measure = Measure(station_id=station.id, type=sensor.type, sensor_name=sensor.sensor_name,
                                  measurement_unit=sensor.measurement_unit, data_type=DATA_TYPE)
                session.add(measure)
                session.flush()
            measure_by_key[(sensor.type, sensor.sensor_name)] = measure

        if replace:
            removed = session.execute(delete(Event).where(Event.station_id == station.id)).rowcount
            print(f"eventos anteriores da estação removidos: {removed}")

        rows = [
            {
                "timestamp": datetime.fromtimestamp(payload["timestamp"], tz=timezone.utc),
                "station_id": station.id,
                "measure_id": measure_by_key[(measure["type"], measure["sensor_name"])].id,
                "measure_type": measure["type"],
                "value": measure["value"],
            }
            for payload in payloads
            for measure in payload["measures"]
        ]
        for start in range(0, len(rows), 2000):
            session.execute(insert(Event), rows[start:start + 2000])
        print(f"eventos gravados na estação '{STATION_UNIQUE_IDENTIFIER}' (id {station.id}): {len(rows)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Simula os sensores a partir de dados reais da NASA e grava em `event`.")
    parser.add_argument("--nasa-data", type=Path, default=DEFAULT_NASA_PATH)
    parser.add_argument("--interval-minutes", type=int, default=10)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--gateway-url", default=os.environ.get(GATEWAY_URL_ENVIRONMENT_VARIABLE),
                        help=f"endereço do station_data_gateway (ou a variável {GATEWAY_URL_ENVIRONMENT_VARIABLE})")
    parser.add_argument("--insecure", action="store_true", help="não verifica o certificado https (certificado de desenvolvimento do Aspire)")
    parser.add_argument("--force", action="store_true", help="envia mesmo que a estação simulada já tenha eventos (duplica)")
    parser.add_argument("--dry-run", action="store_true", help="mostra o resumo sem gravar em lugar nenhum")
    parser.add_argument("--direct-database", action="store_true", help="SÓ PARA TESTES: grava direto no banco, sem passar pelo gateway")
    parser.add_argument("--keep-existing", action="store_true", help="com --direct-database: não apaga os eventos anteriores da estação")
    parser.add_argument("--payloads-out", type=Path, help="grava os pacotes no formato do gateway neste arquivo JSON")
    arguments = parser.parse_args()

    dataset = json.loads(arguments.nasa_data.read_text(encoding="utf-8"))
    payloads = build_payloads(dataset, arguments.interval_minutes, arguments.seed)
    series = NasaSeries(dataset)
    expected_packets = int((series.last_moment - series.first_moment).total_seconds() // (arguments.interval_minutes * 60)) + 1

    print(f"fonte: {dataset['source']} | local: {dataset['location']['name']}")
    print(f"período: {series.first_moment:%Y-%m-%d %H:%M} a {series.last_moment:%Y-%m-%d %H:%M} UTC, a cada {arguments.interval_minutes} min")
    print_summary(payloads, expected_packets)

    if arguments.payloads_out:
        arguments.payloads_out.write_text(json.dumps(payloads, ensure_ascii=False), encoding="utf-8")
        print(f"pacotes gravados em {arguments.payloads_out}")
    if arguments.dry_run:
        return
    if arguments.direct_database:
        load_into_database(payloads, replace=not arguments.keep_existing)
        return
    if not arguments.gateway_url:
        raise SystemExit(f"Informe o endereço do gateway com --gateway-url (ou {GATEWAY_URL_ENVIRONMENT_VARIABLE}). "
                         "Use --dry-run para só ver o resumo.")

    existing = count_existing_events()
    if existing is None:
        print("aviso: sem DATABASE_URL não dá para conferir se a simulação já foi enviada; enviar de novo duplica as leituras")
    elif existing > 0 and not arguments.force:
        raise SystemExit(f"A estação '{STATION_UNIQUE_IDENTIFIER}' já tem {existing} eventos. O gateway não apaga nem confere duplicatas, "
                         "então enviar de novo duplicaria. Apague a estação antes ou use --force.")
    send_to_gateway(payloads, arguments.gateway_url, arguments.insecure)


if __name__ == "__main__":
    main()
