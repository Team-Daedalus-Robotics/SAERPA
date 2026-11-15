from typing import Annotated

from fastapi import APIRouter, Query

from app.deps import SessionDep
from app.services import recommendation_service
from saerpa_shared.schemas import RecommendationResponse

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


@router.get("")
def list_recommendations(
    session: SessionDep,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
) -> list[RecommendationResponse]:
    return recommendation_service.list_latest(session, limit)
