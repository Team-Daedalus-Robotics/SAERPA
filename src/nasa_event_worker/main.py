import os
import time

POLL_SECONDS = int(os.environ.get("NASA_EVENT_POLL_SECONDS", "60"))

print("nasa_event_worker iniciado.", flush=True)

while True:
    print("Nenhum evento novo da NASA.", flush=True)
    time.sleep(POLL_SECONDS)
