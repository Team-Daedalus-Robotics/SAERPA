from sqlalchemy import select
from sqlalchemy.orm import Session

from saerpa_shared.models import Recommendation


def list_latest(session: Session, limit: int) -> list[Recommendation]:
    statement = (
        select(Recommendation)
        .where(Recommendation.deleted.is_not(True))
        .order_by(Recommendation.created_at.desc(), Recommendation.id.desc())
        .limit(limit)
    )
    return list(session.scalars(statement).all())
