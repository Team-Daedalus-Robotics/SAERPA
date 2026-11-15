from datetime import datetime
from typing import Literal

from pydantic import BaseModel

MeasureOrigin = Literal["sensor", "satellite_hourly", "satellite_daily"]


class RecommendationOptionResponse(BaseModel):
    label: str
    description: str | None = None
    probability: float | None = None
    chosen: bool = False


class RecommendationMeasureResponse(BaseModel):
    origin: MeasureOrigin
    measure_type: str | None = None
    sensor_name: str | None = None
    measurement_unit: str | None = None
    latest_value: float | None = None
    average_value: float | None = None
    minimum_value: float | None = None
    maximum_value: float | None = None
    reading_count: int
    latest_at: str | None = None


class RecommendationPlantingResponse(BaseModel):
    crop_name: str
    field_name: str | None = None
    botanical_family: str | None = None
    crop_group: str | None = None
    planting_date: str | None = None
    still_planted: bool = False


class RecommendationResponse(BaseModel):
    id: int
    question_id: str | None = None
    type: str
    question: str | None = None
    model_name: str | None = None
    answer: str | None = None
    choice: str | None = None
    score: float | None = None
    confidence: float | None = None
    options: list[RecommendationOptionResponse]
    measures: list[RecommendationMeasureResponse]
    target_crop_name: str | None = None
    region: str | None = None
    plantings: list[RecommendationPlantingResponse]
    created_at: datetime | None = None
