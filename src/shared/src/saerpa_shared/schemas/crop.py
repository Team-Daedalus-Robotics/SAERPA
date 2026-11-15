from pydantic import BaseModel, ConfigDict


class CropResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    name: str
    botanical_family: str
    crop_group: str
    emoji: str
    row_spacing_centimeters: int
    plant_spacing_centimeters: int
    planting_type: str
    harvest_days_min: int
    harvest_days_max: int
    production_per_square_meter: str | None = None
    source: str
    planting_windows: dict[str, list[int]]
