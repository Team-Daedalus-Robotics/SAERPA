import os
import time

INTERVAL_SECONDS = int(os.environ.get("STATION_GATEWAY_INTERVAL_SECONDS", "30"))

print("station_data_gateway iniciado.", flush=True)

while True:
    print("Gateway de estações em standby (sem fonte de dados configurada).", flush=True)
    time.sleep(INTERVAL_SECONDS)
