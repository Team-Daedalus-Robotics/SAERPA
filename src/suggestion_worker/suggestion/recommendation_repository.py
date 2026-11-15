import json
from collections.abc import Mapping
from typing import Any

from sqlalchemy import inspect, select
from sqlalchemy.exc import SQLAlchemyError

from saerpa_shared.engine import SessionLocal
from saerpa_shared.models import Crop, Event, Measure, Recommendation, SatelliteObservation


def recommendation_schema_ready() -> bool:
    required_columns = {
        "question_id",
        "model_name",
        "instructions",
        "criteria",
        "input_state",
        "choice",
        "score",
        "noul",
        "confidence",
        "probabilities",
        "legend",
        "response_data",
    }

    try:
        with SessionLocal() as session:
            columns = inspect(session.connection()).get_columns("recommendation")
    except SQLAlchemyError:
        return False

    return required_columns.issubset({column["name"] for column in columns})


def save_recommendation(
    question_id: str,
    question_type: str,
    model_name: str,
    instructions: str,
    criteria: Mapping[str, Any] | list[Any] | None,
    state: str | dict[str, Any] | list[Any],
    response: Mapping[str, Any],
    event_ids: list[int] | None = None,
    satellite_observation_ids: list[int] | None = None,
    crop_ids: list[int] | None = None,
) -> None:
    recommendation = Recommendation(
        type=question_type,
        response=json.dumps(response, ensure_ascii=False, default=str),
        observation_text=json.dumps(state, ensure_ascii=False, default=str),
        question_id=question_id,
        model_name=model_name,
        instructions=instructions,
        criteria=criteria,
        input_state=state,
        choice=response.get("choice"),
        score=response.get("score"),
        noul=response.get("noul"),
        confidence=response.get("confidence"),
        probabilities=response.get("probabilities"),
        legend=response.get("legend"),
        response_data=dict(response),
    )

    measure_ids = _measure_ids(state)

    with SessionLocal.begin() as session:
        if measure_ids:
            recommendation.observation = session.scalars(
                select(Measure).where(Measure.id.in_(measure_ids))
            ).all()
        if event_ids:
            recommendation.events = session.scalars(
                select(Event).where(Event.id.in_(event_ids))
            ).all()
        if satellite_observation_ids:
            recommendation.satellite_observations = session.scalars(
                select(SatelliteObservation).where(SatelliteObservation.id.in_(satellite_observation_ids))
            ).all()
        if crop_ids:
            recommendation.crops = session.scalars(
                select(Crop).where(Crop.id.in_(crop_ids))
            ).all()
        session.add(recommendation)


def _measure_ids(state: str | dict[str, Any] | list[Any]) -> set[int]:
    if not isinstance(state, list):
        return set()

    return {
        value
        for item in state
        if isinstance(item, dict)
        for value in [item.get("measure_id")]
        if isinstance(value, int)
    }
