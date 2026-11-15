from fastapi import APIRouter, HTTPException, status

from app.deps import SessionDep
from app.exceptions import InvalidGeometryError, NotFoundError
from app.services import field_service, property_service
from saerpa_shared.schemas import FieldRequest, FieldResponse, PropertyRequest, PropertyResponse

router = APIRouter(prefix="/api/properties", tags=["properties"])


@router.post("", status_code=status.HTTP_201_CREATED)
def create_property(payload: PropertyRequest, session: SessionDep) -> PropertyResponse:
    return property_service.create_property(session, payload)


@router.get("/{property_id}")
def get_property(property_id: int, session: SessionDep) -> PropertyResponse:
    try:
        return property_service.get_property_or_raise(session, property_id)
    except NotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get("/{property_id}/fields")
def list_fields(property_id: int, session: SessionDep) -> list[FieldResponse]:
    try:
        return field_service.list_fields(session, property_id)
    except NotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post("/{property_id}/fields", status_code=status.HTTP_201_CREATED)
def create_field(property_id: int, payload: FieldRequest, session: SessionDep) -> FieldResponse:
    try:
        return field_service.create_field(session, property_id, payload)
    except NotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except InvalidGeometryError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
