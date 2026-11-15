import os
import time

from requests import RequestException
from sqlalchemy.exc import SQLAlchemyError
from suggestion.worker import process_suggestions

SCAN_SECONDS = int(os.environ.get("SUGGESTION_SCAN_SECONDS", str(12 * 60 * 60)))


def main() -> None:
    print("suggestion_worker iniciado.", flush=True)
    while True:
        try:
            process_suggestions()
        except (RequestException, RuntimeError, SQLAlchemyError, ValueError) as error:
            print(f"Não foi possível gerar a sugestão: {error}", flush=True)
        time.sleep(SCAN_SECONDS)


if __name__ == "__main__":
    main()
