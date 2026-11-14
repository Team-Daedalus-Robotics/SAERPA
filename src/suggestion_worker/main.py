import os
import time

SCAN_SECONDS = int(os.environ.get("SUGGESTION_SCAN_SECONDS", "45"))

print("suggestion_worker iniciado.", flush=True)

while True:
    print("Nenhuma sugestão para processar.", flush=True)
    time.sleep(SCAN_SECONDS)
