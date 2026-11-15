import re
from collections.abc import Mapping
from typing import Any

from sqlalchemy.orm import Session

from app.repositories import recommendation_repository
from saerpa_shared.models import Recommendation
from saerpa_shared.schemas import (
    RecommendationMeasureResponse,
    RecommendationOptionResponse,
    RecommendationPlantingResponse,
    RecommendationResponse,
)

LEVEL_PATTERN = re.compile(r"^\s*(\d+)\s*[:.)-]\s*(.+)$")


def _to_number(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _entries(state: Any, key: str) -> list[dict[str, Any]]:
    if not isinstance(state, Mapping):
        return []
    entries = state.get(key)
    if not isinstance(entries, list):
        return []
    return [entry for entry in entries if isinstance(entry, Mapping)]


def _summarize(
    origin: str,
    entries: list[dict[str, Any]],
    type_key: str,
    time_key: str | None,
) -> list[RecommendationMeasureResponse]:
    """Agrupa as leituras enviadas ao modelo por medida; a primeira de cada grupo é a mais recente."""
    groups: dict[tuple[Any, Any, Any], list[dict[str, Any]]] = {}
    for entry in entries:
        key = (entry.get(type_key), entry.get("sensor_name"), entry.get("measurement_unit"))
        groups.setdefault(key, []).append(entry)

    measures = []
    for (measure_type, sensor_name, measurement_unit), readings in groups.items():
        values = [value for value in (_to_number(reading.get("value")) for reading in readings) if value is not None]
        latest_at = readings[0].get(time_key) if time_key else None
        measures.append(
            RecommendationMeasureResponse(
                origin=origin,
                measure_type=measure_type,
                sensor_name=sensor_name,
                measurement_unit=measurement_unit,
                latest_value=_to_number(readings[0].get("value")),
                average_value=sum(values) / len(values) if values else None,
                minimum_value=min(values) if values else None,
                maximum_value=max(values) if values else None,
                reading_count=len(readings),
                latest_at=str(latest_at) if latest_at is not None else None,
            )
        )
    return measures


def _measures(state: Any) -> list[RecommendationMeasureResponse]:
    return [
        *_summarize("sensor", _entries(state, "sensor_readings"), "data_type", None),
        *_summarize("satellite_hourly", _entries(state, "satellite"), "measure_type", "timestamp"),
        *_summarize("satellite_daily", _entries(state, "satellite_observations"), "variable", "observed_at"),
    ]


def _probability(probabilities: Any, label: str, position: int, level: str | None) -> float | None:
    if isinstance(probabilities, Mapping):
        for key in (label, level, str(position + 1)):
            if key is not None and key in probabilities:
                return _to_number(probabilities[key])
        return None
    if isinstance(probabilities, list) and position < len(probabilities):
        return _to_number(probabilities[position])
    return None


def _options(recommendation: Recommendation) -> list[RecommendationOptionResponse]:
    criteria = recommendation.criteria
    probabilities = recommendation.probabilities
    options: list[RecommendationOptionResponse] = []

    if isinstance(criteria, Mapping):
        for position, (label, description) in enumerate(criteria.items()):
            options.append(
                RecommendationOptionResponse(
                    label=str(label),
                    description=str(description) if description else None,
                    probability=_probability(probabilities, str(label), position, None),
                    chosen=str(label) == recommendation.choice,
                )
            )
        options.sort(key=lambda option: (not option.chosen, -(option.probability or 0)))
    elif isinstance(criteria, list):
        chosen_level = round(recommendation.score) if recommendation.score is not None else None
        for position, text in enumerate(criteria):
            match = LEVEL_PATTERN.match(str(text))
            level = match.group(1) if match else str(position + 1)
            options.append(
                RecommendationOptionResponse(
                    label=level,
                    description=match.group(2) if match else str(text),
                    probability=_probability(probabilities, str(text), position, level),
                    chosen=chosen_level is not None and level == str(chosen_level),
                )
            )
    return options


def _answer(recommendation: Recommendation, options: list[RecommendationOptionResponse]) -> str | None:
    if recommendation.choice:
        return recommendation.choice
    chosen = next((option for option in options if option.chosen), None)
    if chosen is not None:
        return chosen.description or chosen.label
    return None


def _plantings(state: Any) -> list[RecommendationPlantingResponse]:
    return [
        RecommendationPlantingResponse(
            crop_name=str(planting["crop_name"]),
            field_name=planting.get("field_name"),
            botanical_family=planting.get("botanical_family"),
            crop_group=planting.get("crop_group"),
            planting_date=planting.get("planting_date"),
            still_planted=bool(planting.get("still_planted")),
        )
        for planting in _entries(state, "planting_history")
        if planting.get("crop_name")
    ]


def _to_response(recommendation: Recommendation) -> RecommendationResponse:
    state = recommendation.input_state
    crop = state.get("crop") if isinstance(state, Mapping) else None
    options = _options(recommendation)
    return RecommendationResponse(
        id=recommendation.id,
        question_id=recommendation.question_id,
        type=recommendation.type,
        question=recommendation.instructions,
        model_name=recommendation.model_name,
        answer=_answer(recommendation, options),
        choice=recommendation.choice,
        score=recommendation.score,
        confidence=recommendation.confidence,
        options=options,
        measures=_measures(state),
        target_crop_name=crop.get("name") if isinstance(crop, Mapping) else None,
        region=state.get("region") if isinstance(state, Mapping) else None,
        plantings=_plantings(state),
        created_at=recommendation.created_at,
    )


def list_latest(session: Session, limit: int) -> list[RecommendationResponse]:
    return [_to_response(recommendation) for recommendation in recommendation_repository.list_latest(session, limit)]
