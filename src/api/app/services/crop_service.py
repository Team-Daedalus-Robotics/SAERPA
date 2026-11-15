from sqlalchemy.orm import Session

from app.repositories import crop_repository
from saerpa_shared.models import Crop
from saerpa_shared.schemas import CropResponse


def _to_response(crop: Crop) -> CropResponse:
    planting_windows: dict[str, list[int]] = {}
    for window in crop.planting_windows:
        if window.deleted:
            continue
        planting_windows.setdefault(window.region, []).append(window.month)
    for months in planting_windows.values():
        months.sort()

    return CropResponse(
        slug=crop.slug,
        name=crop.name,
        botanical_family=crop.botanical_family,
        crop_group=crop.crop_group,
        emoji=crop.emoji,
        row_spacing_centimeters=crop.row_spacing_centimeters,
        plant_spacing_centimeters=crop.plant_spacing_centimeters,
        planting_type=crop.planting_type,
        harvest_days_min=crop.harvest_days_min,
        harvest_days_max=crop.harvest_days_max,
        production_per_square_meter=crop.production_per_square_meter,
        source=crop.source,
        planting_windows=planting_windows,
    )


def list_catalog(session: Session) -> list[CropResponse]:
    return [_to_response(crop) for crop in crop_repository.list_catalog(session)]
