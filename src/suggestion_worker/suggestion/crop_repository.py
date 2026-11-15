import os
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from saerpa_shared.engine import SessionLocal
from saerpa_shared.models import Crop, CropPlantingWindow, Field, Planting, Property

REGIONS = ("Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul")


def configured_region() -> str:
    region = os.getenv("SUGGESTION_REGION", "Sul")
    return region if region in REGIONS else "Sul"


def planting_month_candidates(month: int, region: str) -> list[dict]:
    """Culturas da tabela Embrapa com época de plantio aberta na região e no mês."""
    statement = (
        select(Crop)
        .options(joinedload(Crop.planting_windows))
        .join(CropPlantingWindow, CropPlantingWindow.crop_id == Crop.id)
        .where(
            Crop.deleted.is_(False),
            Crop.slug.isnot(None),
            CropPlantingWindow.deleted.is_(False),
            CropPlantingWindow.region == region,
            CropPlantingWindow.month == month,
        )
        .order_by(Crop.name)
    )
    with SessionLocal() as session:
        crops = session.scalars(statement).unique().all()
    return [
        {
            "crop_id": crop.id,
            "name": crop.name,
            "botanical_family": crop.botanical_family,
            "crop_group": crop.crop_group,
            "harvest_days_min": crop.harvest_days_min,
            "harvest_days_max": crop.harvest_days_max,
        }
        for crop in crops
    ]


def latest_plantings(limit: int = 10) -> list[dict]:
    """Últimos plantios registrados (planting), do mais recente ao mais antigo."""
    statement = (
        select(Planting)
        .options(joinedload(Planting.crop), joinedload(Planting.field).joinedload(Field.property))
        .join(Field, Planting.field_id == Field.id)
        .join(Property, Field.property_id == Property.id)
        .where(Planting.deleted.is_(False), Property.deleted.is_(False))
        .order_by(Planting.planting_date.desc(), Planting.id.desc())
        .limit(limit)
    )
    with SessionLocal() as session:
        plantings = session.scalars(statement).all()
    return [
        {
            "crop_id": planting.crop.id,
            "field_id": planting.field_id,
            "field_name": planting.field.name,
            "crop_name": planting.crop.name,
            "botanical_family": planting.crop.botanical_family,
            "crop_group": planting.crop.crop_group,
            "planting_date": planting.planting_date.isoformat() if planting.planting_date else None,
            "harvest_date": planting.harvest_date.isoformat() if planting.harvest_date else None,
            "still_planted": planting.harvest_date is None,
        }
        for planting in plantings
    ]


def rotation_state(month: int, region: str) -> dict | None:
    """Estado completo da rotação: histórico, época atual e catálogo Embrapa candidato."""
    candidates = planting_month_candidates(month=month, region=region)
    if not candidates:
        return None
    today = date.today()
    return {
        "today": today.isoformat(),
        "month": today.month,
        "region": region,
        "planting_history": latest_plantings(),
        "planting_window_candidates": candidates,
    }
