from datetime import date

from sqlalchemy.exc import DataError, InternalError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.exceptions import InvalidGeometryError, NotFoundError
from app.repositories import crop_repository, field_repository, planting_repository
from app.repositories.field_repository import FieldRow
from app.services import property_service
from saerpa_shared.models import Planting
from saerpa_shared.schemas import (
    CoordinateResponse,
    FieldHistoryRequest,
    FieldHistoryResponse,
    FieldRequest,
    FieldResponse,
)


def _build_history(plantings: list[Planting], slug_by_crop_id: dict[int, str]) -> FieldHistoryResponse:
    slugs = [slug_by_crop_id[planting.crop_id] for planting in plantings]
    if not slugs:
        return FieldHistoryResponse()
    return FieldHistoryResponse(last_crop_slug=slugs[-1], previous_crop_slugs=slugs[:-1])


def _build_responses(session: Session, rows: list[FieldRow]) -> list[FieldResponse]:
    plantings = planting_repository.list_by_fields(session, [row.field.id for row in rows])
    crops = crop_repository.list_by_ids(session, sorted({planting.crop_id for planting in plantings}))
    slug_by_crop_id = {crop.id: crop.slug for crop in crops}

    plantings_by_field: dict[int, list[Planting]] = {}
    for planting in plantings:
        plantings_by_field.setdefault(planting.field_id, []).append(planting)

    return [
        FieldResponse(
            id=row.field.id,
            property_id=row.field.property_id,
            name=row.field.name,
            coordinates=[CoordinateResponse(lat=latitude, lng=longitude) for latitude, longitude in row.coordinates],
            area_in_hectares=row.area_in_hectares,
            history=_build_history(plantings_by_field.get(row.field.id, []), slug_by_crop_id),
        )
        for row in rows
    ]


def _get_row_or_raise(session: Session, field_id: int) -> FieldRow:
    row = field_repository.get_row(session, field_id)
    if row is None:
        raise NotFoundError("Área não encontrada.")
    return row


def list_fields(session: Session, property_id: int) -> list[FieldResponse]:
    property_service.get_property_or_raise(session, property_id)
    return _build_responses(session, field_repository.list_rows_by_property(session, property_id))


def create_field(session: Session, property_id: int, payload: FieldRequest) -> FieldResponse:
    property_service.get_property_or_raise(session, property_id)
    coordinates = [(point.lat, point.lng) for point in payload.coordinates]

    try:
        if not field_repository.is_valid_polygon(session, coordinates):
            raise InvalidGeometryError("O contorno da área se cruza. Marque os cantos em ordem, sem cruzar as linhas.")
        field = field_repository.create(session, property_id, payload.name, coordinates)
        session.commit()
    except (DataError, InternalError) as error:
        session.rollback()
        raise InvalidGeometryError("Contorno da área inválido.") from error
    except SQLAlchemyError:
        session.rollback()
        raise
    except InvalidGeometryError:
        session.rollback()
        raise

    return _build_responses(session, [_get_row_or_raise(session, field.id)])[0]


def delete_field(session: Session, field_id: int) -> None:
    field = field_repository.get_by_id(session, field_id)
    if field is None:
        raise NotFoundError("Área não encontrada.")

    try:
        field.deleted = True
        planting_repository.soft_delete_by_field(session, field_id)
        session.commit()
    except SQLAlchemyError:
        session.rollback()
        raise


def replace_history(session: Session, field_id: int, payload: FieldHistoryRequest) -> FieldResponse:
    _get_row_or_raise(session, field_id)

    ordered_slugs = [*payload.previous_crop_slugs, *([payload.last_crop_slug] if payload.last_crop_slug else [])]
    crop_by_slug = {crop.slug: crop for crop in crop_repository.list_by_slugs(session, sorted(set(ordered_slugs)))}
    unknown_slugs = [slug for slug in ordered_slugs if slug not in crop_by_slug]
    if unknown_slugs:
        raise NotFoundError(f"Cultura não encontrada: {', '.join(sorted(set(unknown_slugs)))}.")

    try:
        planting_repository.soft_delete_by_field(session, field_id)
        for slug in ordered_slugs:
            planting_repository.create(session, field_id, crop_by_slug[slug].id, date.today())
        session.commit()
    except SQLAlchemyError:
        session.rollback()
        raise

    return _build_responses(session, [_get_row_or_raise(session, field_id)])[0]
