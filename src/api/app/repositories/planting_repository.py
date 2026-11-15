from datetime import date

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from saerpa_shared.models import Field, Planting


def list_by_fields(session: Session, field_ids: list[int]) -> list[Planting]:
    if not field_ids:
        return []
    statement = (
        select(Planting)
        .where(Planting.field_id.in_(field_ids), Planting.deleted.is_(False))
        .order_by(Planting.field_id, Planting.id)
    )
    return list(session.scalars(statement).all())


def soft_delete_by_field(session: Session, field_id: int) -> None:
    session.execute(update(Planting).where(Planting.field_id == field_id, Planting.deleted.is_(False)).values(deleted=True))


def create(session: Session, field_id: int, crop_id: int, planting_date: date) -> Planting:
    planting = Planting(field_id=field_id, crop_id=crop_id, planting_date=planting_date)
    session.add(planting)
    session.flush()
    return planting


def soft_delete_by_property(session: Session, property_id: int) -> None:
    field_ids = select(Field.id).where(Field.property_id == property_id)
    session.execute(update(Planting).where(Planting.field_id.in_(field_ids), Planting.deleted.is_(False)).values(deleted=True))
