import json
from importlib import resources

from sqlalchemy import delete, select

from saerpa_shared.engine import SessionLocal
from saerpa_shared.models import Crop, CropPlantingWindow

_CROP_COLUMNS = (
    "name",
    "botanical_family",
    "crop_group",
    "emoji",
    "row_spacing_centimeters",
    "plant_spacing_centimeters",
    "planting_type",
    "harvest_days_min",
    "harvest_days_max",
    "production_per_square_meter",
    "source",
)


def _load_crop_seed() -> list[dict]:
    seed_path = resources.files("saerpa_shared") / "seed" / "crops.json"
    return json.loads(seed_path.read_text(encoding="utf-8"))


def seed_crops() -> None:
    """Grava o catálogo da Embrapa em `crop` e `crop_planting_window` (idempotente, por slug)."""
    seed = _load_crop_seed()

    with SessionLocal() as session:
        existing_by_slug = {crop.slug: crop for crop in session.scalars(select(Crop).where(Crop.slug.is_not(None)))}

        for entry in seed:
            crop = existing_by_slug.get(entry["slug"])
            if crop is None:
                crop = Crop(slug=entry["slug"])
                session.add(crop)
            for column in _CROP_COLUMNS:
                setattr(crop, column, entry[column])
            crop.deleted = False
            session.flush()

            session.execute(delete(CropPlantingWindow).where(CropPlantingWindow.crop_id == crop.id))
            for region, months in entry["planting_windows"].items():
                for month in months:
                    session.add(CropPlantingWindow(crop_id=crop.id, region=region, month=month))

        session.commit()
