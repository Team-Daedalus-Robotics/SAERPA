from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.exceptions import NotFoundError
from app.repositories import property_repository
from saerpa_shared.models import Property
from saerpa_shared.schemas import PropertyRequest


def create_property(session: Session, payload: PropertyRequest) -> Property:
    property_ = property_repository.create(session, payload.name, payload.lat, payload.lng)

    try:
        session.commit()
    except SQLAlchemyError:
        session.rollback()
        raise

    session.refresh(property_)
    return property_


def get_property_or_raise(session: Session, property_id: int) -> Property:
    property_ = property_repository.get_by_id(session, property_id)
    if property_ is None:
        raise NotFoundError("Propriedade não encontrada.")
    return property_
