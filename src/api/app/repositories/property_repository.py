from sqlalchemy.orm import Session

from saerpa_shared.models import Property


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
