import datetime

from suggestion import crop_repository, observation_repository, questions
from suggestion.laya import evaluate_choice, evaluate_score
from suggestion.recommendation_repository import recommendation_schema_ready
from scripts.laya_server import ensure_laya_server


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
        if not satellite and not sensor_readings:
            print(f"Sem leituras de sensores ou satélite para '{question.question_id}'.", flush=True)
            continue

        state: dict = {"sensor_readings": sensor_readings, "satellite": satellite}
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

        try:
            if question.question_type == "choice":
                response = evaluate_choice(
                    state=state,
                    instructions=question.instructions,
                    criteria=criteria,
                    question_id=question.question_id,
                )
            else:
                response = evaluate_score(
                    question=question.instructions,
                    answers=question.answers,
                    state=state,
                    question_id=question.question_id,
                )
        except (RuntimeError, ValueError) as error:
            print(f"Falha ao avaliar '{question.question_id}': {error}", flush=True)
            continue
        print(f"{question.question_id}: {response}", flush=True)
