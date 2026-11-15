from fastapi import APIRouter, HTTPException, Query, Response, status

from app.deps import SessionDep
from app.exceptions import ExternalServiceError
from app.services import climate_service
from saerpa_shared.schemas import ClimatePendingResponse, ClimateResponse

router = APIRouter(prefix="/api/climate", tags=["climate"])


@router.get("", responses={status.HTTP_202_ACCEPTED: {"model": ClimatePendingResponse}})
def get_climate(
    response: Response,
    session: SessionDep,
    lat: float = Query(ge=-90, le=90),
    lng: float = Query(ge=-180, le=180),
) -> ClimateResponse | ClimatePendingResponse:
    try:
        result = climate_service.get_climate(session, lat, lng)
    except ExternalServiceError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    if isinstance(result, ClimatePendingResponse):
        response.status_code = status.HTTP_202_ACCEPTED
    return result
