import os
import time

from sqlalchemy.exc import SQLAlchemyError

from saerpa_shared import climate
from saerpa_shared.engine import SessionLocal

POLL_SECONDS = float(os.environ.get("NASA_EVENT_POLL_SECONDS", "3"))

print("nasa_event_worker iniciado.", flush=True)

waiting_for_database = False
while True:
    try:
        for identifier, inserted, error in climate.process_pending_cells(SessionLocal):
            if error is None:
                print(f"{identifier}: {inserted} eventos novos da NASA.", flush=True)
            else:
                print(f"{identifier}: falhou ({error}); tenta de novo em {int(climate.RETRY_AFTER_ERROR.total_seconds())} s.", flush=True)
        waiting_for_database = False
    except SQLAlchemyError as error:
        if not waiting_for_database:
            print(f"Banco ainda não está pronto (as migrations são aplicadas pela API): {type(error).__name__}", flush=True)
        waiting_for_database = True
    time.sleep(POLL_SECONDS)
