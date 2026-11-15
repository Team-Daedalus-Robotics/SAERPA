from fastapi import APIRouter, status

from app.deps import SessionDep
from app.services import station_data_service
from saerpa_shared.schemas import StationDataRequest, StationDataResponse

router = APIRouter(prefix="/api/stations", tags=["stations"])


@router.post("/data", status_code=status.HTTP_201_CREATED)
def ingest_station_data(
    payload: StationDataRequest, session: SessionDep
) -> StationDataResponse:
    return station_data_service.ingest_station_data(session, payload)
