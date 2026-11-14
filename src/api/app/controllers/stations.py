from fastapi import APIRouter, HTTPException, status

from saerpa_shared.schemas import MeasureResponse, StationRequest, StationResponse

from app.deps import SessionDep
from app.exceptions import ConflictError, NotFoundError
from app.services import station_service

router = APIRouter(prefix="/api/stations", tags=["stations"])


@router.post("", status_code=status.HTTP_201_CREATED)
def create_station(payload: StationRequest, session: SessionDep) -> StationResponse:
    try:
        station = station_service.create_station(session, payload.unique_identifier)
    except ConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error

    return station


@router.get("")
def list_stations(session: SessionDep) -> list[StationResponse]:
    return station_service.list_stations(session)


@router.get("/{station_id}/measures")
def list_measures(station_id: int, session: SessionDep) -> list[MeasureResponse]:
    try:
        measures = station_service.list_measures(session, station_id)
    except NotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    return measures
