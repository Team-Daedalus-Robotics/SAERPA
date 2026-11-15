"""Client for the /api/decide endpoint."""

from collections.abc import Mapping, Sequence
from typing import Any, Literal

import requests
from typesafe_sdk import TypeSafeClient

from suggestion.confing import API_KEY, BASE_URL, DECIDE_URL, MODEL
from suggestion.recommendation_repository import save_recommendation

DecisionType = Literal["choice", "score", "noul"]
DecisionState = str | dict[str, Any] | list[Any]
ChoiceCriteria = Mapping[str, str | None]
ScoreCriteria = Sequence[str]
NoulCriteria = Mapping[str, str]


def create_client() -> TypeSafeClient:
    """Create a TypeSafe client using the configured API settings."""
    return TypeSafeClient(api_key=API_KEY, base_url=BASE_URL, model=MODEL)


def evaluate_choice(
    state: DecisionState,
    instructions: str,
    criteria: ChoiceCriteria,
    question_id: str = "answer",
    timeout: float = 60,
    event_ids: list[int] | None = None,
    satellite_observation_ids: list[int] | None = None,
    crop_ids: list[int] | None = None,
) -> dict[str, Any]:
    """Choose from caller-provided options using the supplied state."""
    if not isinstance(criteria, Mapping) or not criteria:
        raise ValueError("Choice criteria must map option names to descriptions.")
    if len(criteria) > 255:
        raise ValueError("Choice questions support at most 255 options.")

    return _evaluate_decision(
        state=state,
        question_type="choice",
        instructions=instructions,
        criteria=dict(criteria),
        question_id=question_id,
        timeout=timeout,
        event_ids=event_ids,
        satellite_observation_ids=satellite_observation_ids,
        crop_ids=crop_ids,
    )


def evaluate_score(
    question: str,
    answers: ScoreCriteria,
    state: DecisionState,
    question_id: str = "answer",
    timeout: float = 60,
    event_ids: list[int] | None = None,
    satellite_observation_ids: list[int] | None = None,
    crop_ids: list[int] | None = None,
) -> dict[str, Any]:
    """Score the caller-provided state against caller-provided ordered levels."""
    if not question.strip():
        raise ValueError("Informe a pergunta para avaliar os eventos.")
    if isinstance(answers, (str, bytes)) or not isinstance(answers, Sequence):
        raise ValueError("Answers must be an ordered sequence of level descriptions.")
    if not 2 <= len(answers) <= 10 or any(not answer.strip() for answer in answers):
        raise ValueError("Score questions require 2 to 10 non-empty answer levels.")

    return _evaluate_decision(
        state=state,
        question_type="score",
        instructions=question,
        criteria=list(answers),
        question_id=question_id,
        timeout=timeout,
        event_ids=event_ids,
        satellite_observation_ids=satellite_observation_ids,
        crop_ids=crop_ids,
    )


def evaluate_noul(
    state: DecisionState,
    instructions: str,
    criteria: NoulCriteria | None = None,
    question_id: str = "answer",
    timeout: float = 60,
) -> dict[str, Any]:
    """Return a yes/no probability for the supplied state and instructions."""
    if criteria is not None:
        if not isinstance(criteria, Mapping) or not {"true", "false"}.issubset(criteria):
            raise ValueError("Noul criteria must describe both 'true' and 'false'.")

    return _evaluate_decision(
        state=state,
        question_type="noul",
        instructions=instructions,
        criteria=dict(criteria) if criteria is not None else None,
        question_id=question_id,
        timeout=timeout,
    )


def _evaluate_decision(
    state: DecisionState,
    question_type: DecisionType,
    instructions: str,
    criteria: ChoiceCriteria | ScoreCriteria | NoulCriteria | None,
    question_id: str,
    timeout: float,
    event_ids: list[int] | None = None,
    satellite_observation_ids: list[int] | None = None,
    crop_ids: list[int] | None = None,
) -> dict[str, Any]:
    """Send one typed decision request and return its complete answer."""
    if not question_id.strip():
        raise ValueError("question_id must not be empty.")
    if not instructions.strip():
        raise ValueError("instructions must not be empty.")

    question_spec: dict[str, Any] = {
        "type": question_type,
        "instructions": instructions,
    }
    if criteria is not None:
        question_spec["criteria"] = dict(criteria) if isinstance(criteria, Mapping) else list(criteria)

    response = requests.post(
        DECIDE_URL,
        headers={"Authorization": f"Bearer {API_KEY}"},
        json={
            "model": MODEL,
            "state": state,
            "questions": {question_id: question_spec},
        },
        timeout=timeout,
    )
    response.raise_for_status()
    payload: dict[str, Any] = response.json()
    answer = payload["answers"][question_id]
    save_recommendation(
        question_id=question_id,
        question_type=question_type,
        model_name=payload.get("model", MODEL),
        instructions=instructions,
        criteria=question_spec.get("criteria"),
        state=state,
        response=answer,
        event_ids=event_ids,
        satellite_observation_ids=satellite_observation_ids,
        crop_ids=crop_ids,
    )
    return answer
