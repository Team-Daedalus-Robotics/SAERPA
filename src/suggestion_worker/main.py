import os
import time

from requests import RequestException
from sqlalchemy.exc import SQLAlchemyError
from suggestion.worker import process_new_events

SCAN_SECONDS = int(os.environ.get("SUGGESTION_SCAN_SECONDS", "500"))


def main() -> None:
    print("suggestion_worker iniciado.", flush=True)
    last_event_id = None
    while True:
        try:
            last_event_id = process_new_events(last_event_id)
        except (RequestException, RuntimeError, SQLAlchemyError, ValueError) as error:
            print(f"Não foi possível gerar a sugestão: {error}", flush=True)
        time.sleep(SCAN_SECONDS)


if __name__ == "__main__":
    main()
