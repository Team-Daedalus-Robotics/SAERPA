from geoalchemy2 import Geometry
from sqlalchemy import cast, func, select, update
from sqlalchemy.orm import Session

from saerpa_shared.models import Field, Property


def create(session: Session, name: str, lat: float, lng: float) -> Property:
    property_ = Property(name=name, lat=lat, lng=lng)
    session.add(property_)
    session.flush()
    return property_


def get_by_id(session: Session, property_id: int) -> Property | None:
    property_ = session.get(Property, property_id)
    if property_ is None or property_.deleted:
        return None
    return property_


def refresh_location_from_fields(session: Session, property_id: int) -> None:
    """Centro das áreas da propriedade (ponderado pelo tamanho de cada uma); sem áreas, mantém o ponto atual."""
    centroid = func.ST_Centroid(func.ST_Collect(cast(Field.geometry, Geometry)))
    latitude, longitude = session.execute(
        select(func.ST_Y(centroid), func.ST_X(centroid)).where(Field.property_id == property_id, Field.deleted.is_(False))
    ).one()
    if latitude is None or longitude is None:
        return

    property_ = session.get(Property, property_id)
    property_.lat = latitude
    property_.lng = longitude


def soft_delete(session: Session, property_: Property) -> None:
    property_.deleted = True
    session.execute(update(Field).where(Field.property_id == property_.id, Field.deleted.is_(False)).values(deleted=True))
