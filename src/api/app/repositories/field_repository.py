import json
from dataclasses import dataclass

from geoalchemy2 import WKTElement
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from saerpa_shared.models import Field

SQUARE_METERS_PER_HECTARE = 10_000


@dataclass
class FieldRow:
    field: Field
    coordinates: list[tuple[float, float]]
    area_in_hectares: float


def _to_row(field: Field, geometry_json: str, area_in_square_meters: float) -> FieldRow:
    ring = json.loads(geometry_json)["coordinates"][0]
    coordinates = [(latitude, longitude) for longitude, latitude in ring[:-1]]
    return FieldRow(field, coordinates, area_in_square_meters / SQUARE_METERS_PER_HECTARE)


def _row_statement():
    return select(Field, func.ST_AsGeoJSON(Field.geometry), func.ST_Area(Field.geometry))


def _polygon_wkt(coordinates: list[tuple[float, float]]) -> str:
    ring = [*coordinates, coordinates[0]]
    return "POLYGON((" + ", ".join(f"{longitude} {latitude}" for latitude, longitude in ring) + "))"


def is_valid_polygon(session: Session, coordinates: list[tuple[float, float]]) -> bool:
    return bool(session.scalar(select(func.ST_IsValid(func.ST_GeomFromText(_polygon_wkt(coordinates), 4326)))))


def create(session: Session, property_id: int, name: str, coordinates: list[tuple[float, float]]) -> Field:
    wkt = _polygon_wkt(coordinates)
    field = Field(property_id=property_id, name=name, geometry=WKTElement(wkt, srid=4326))
    session.add(field)
    session.flush()
    return field


def get_row(session: Session, field_id: int) -> FieldRow | None:
    result = session.execute(_row_statement().where(Field.id == field_id, Field.deleted.is_(False))).first()
    return _to_row(*result) if result else None


def list_rows_by_property(session: Session, property_id: int) -> list[FieldRow]:
    statement = _row_statement().where(Field.property_id == property_id, Field.deleted.is_(False)).order_by(Field.id)
    return [_to_row(*result) for result in session.execute(statement).all()]


def get_by_id(session: Session, field_id: int) -> Field | None:
    field = session.get(Field, field_id)
    if field is None or field.deleted:
        return None
    return field
