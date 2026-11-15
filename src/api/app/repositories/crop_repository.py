from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from saerpa_shared.models import Crop


def list_catalog(session: Session) -> list[Crop]:
    statement = (
        select(Crop)
        .where(Crop.slug.is_not(None), Crop.deleted.is_(False))
        .options(selectinload(Crop.planting_windows))
        .order_by(Crop.name)
    )
    return list(session.scalars(statement).all())


def list_by_slugs(session: Session, slugs: list[str]) -> list[Crop]:
    if not slugs:
        return []
    return list(session.scalars(select(Crop).where(Crop.slug.in_(slugs), Crop.deleted.is_(False))).all())


def list_by_ids(session: Session, crop_ids: list[int]) -> list[Crop]:
    if not crop_ids:
        return []
    return list(session.scalars(select(Crop).where(Crop.id.in_(crop_ids))).all())
