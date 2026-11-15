from sqlalchemy import func, select

from saerpa_shared.engine import SessionLocal
from saerpa_shared.models import Event
from scripts.laya_server import ensure_laya_server
from suggestion.laya import evaluate_score
from suggestion.recommendation_repository import recommendation_schema_ready


QUESTION = "Qual é a condição da umidade do solo?"
ANSWERS = [
    "1: muito seca",
    "2: seca",
    "3: adequada",
    "4: úmida",
    "5: muito úmida",
]


def process_new_events(last_event_id: int | None) -> int | None:
    if not recommendation_schema_ready():
        return last_event_id

    with SessionLocal() as session:
        latest_event_id = session.scalar(select(func.max(Event.id)))

    if latest_event_id is None or latest_event_id == last_event_id:
        return last_event_id

    ensure_laya_server()
    response = evaluate_score(question=QUESTION, answers=ANSWERS)
    print(response, flush=True)
    return latest_event_id
