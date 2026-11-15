from fastapi import APIRouter, HTTPException, Query

from app.deps import SessionDep
from app.exceptions import ExternalServiceError
from app.services import climate_service
from saerpa_shared.schemas import ClimateResponse

router = APIRouter(prefix="/api/climate", tags=["climate"])


@router.get("")
def get_climate(
    session: SessionDep,
    lat: float = Query(ge=-90, le=90),
    lng: float = Query(ge=-180, le=180),
) -> ClimateResponse:
    try:
        return climate_service.get_climate(session, lat, lng)
    except ExternalServiceError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
