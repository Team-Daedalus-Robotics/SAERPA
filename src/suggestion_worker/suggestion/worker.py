import datetime

from suggestion import crop_repository, observation_repository, questions
from suggestion.laya import evaluate_choice, evaluate_score
from suggestion.recommendation_repository import recommendation_schema_ready
from scripts.laya_server import ensure_laya_server

ID_FIELDS = ("event_id", "satellite_observation_id", "crop_id")


def without_ids(entries: list[dict]) -> list[dict]:
    return [{key: value for key, value in entry.items() if key not in ID_FIELDS} for entry in entries]


def process_suggestions() -> None:
    if not recommendation_schema_ready():
        return

    enabled = questions.enabled_questions()
    if not enabled:
        print("Nenhuma pergunta habilitada em SUGGESTION_QUESTIONS.", flush=True)
        return

    ensure_laya_server()
    crop = questions.target_crop()
    sensor_readings = observation_repository.latest_sensor_readings()

    for question in enabled:
        satellite = observation_repository.latest_satellite_readings(
            question.required_satellite_measures
        )
        satellite_observations = observation_repository.latest_satellite_observations(
            question.required_satellite_measures
        )
        if not satellite and not satellite_observations and not sensor_readings:
            print(f"Sem leituras de sensores ou satélite para '{question.question_id}'.", flush=True)
            continue

        state: dict = {
            "sensor_readings": without_ids(sensor_readings),
            "satellite": without_ids(satellite),
            "satellite_observations": without_ids(satellite_observations),
        }
        event_ids = observation_repository.event_ids(sensor_readings) + observation_repository.event_ids(satellite)
        satellite_observation_ids = observation_repository.satellite_observation_ids(satellite_observations)
        crop_ids: set[int] = set()
        criteria = question.answers

        if question.question_type == "choice":
            rotation = crop_repository.rotation_state(
                month=datetime.date.today().month,
                region=crop_repository.configured_region(),
            )
            if rotation is None:
                print(
                    "Nenhuma cultura com época de plantio neste mês na região "
                    f"{crop_repository.configured_region()}.",
                    flush=True,
                )
                continue
            state.update(rotation)
            crop_ids = {
                candidate["crop_id"] for candidate in rotation["planting_window_candidates"]
            } | {
                planting["crop_id"] for planting in rotation["planting_history"] if "crop_id" in planting
            }
            criteria = {
                candidate["name"]: (
                    f"família {candidate['botanical_family'] or 'não classificada'}, "
                    f"grupo {candidate['crop_group'] or 'não classificado'}, "
                    f"colheita em {candidate['harvest_days_min']} a "
                    f"{candidate['harvest_days_max']} dias"
                )
                for candidate in rotation["planting_window_candidates"]
            }
        elif question.question_id == "irrigation_need":
            if crop is None:
                print("Nenhuma cultura no catálogo para a pergunta irrigation_need.", flush=True)
                continue
            state["crop"] = crop
            crop_ids = {crop["crop_id"]}

        try:
            if question.question_type == "choice":
                response = evaluate_choice(
                    state=state,
                    instructions=question.instructions,
                    criteria=criteria,
                    question_id=question.question_id,
                    event_ids=event_ids,
                    satellite_observation_ids=satellite_observation_ids,
                    crop_ids=sorted(crop_ids),
                )
            else:
                response = evaluate_score(
                    question=question.instructions,
                    answers=question.answers,
                    state=state,
                    question_id=question.question_id,
                    event_ids=event_ids,
                    satellite_observation_ids=satellite_observation_ids,
                    crop_ids=sorted(crop_ids),
                )
        except (RuntimeError, ValueError) as error:
            print(f"Falha ao avaliar '{question.question_id}': {error}", flush=True)
            continue
        print(f"{question.question_id}: {response}", flush=True)
