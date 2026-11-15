from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

FieldName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]


class CoordinateRequest(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class CoordinateResponse(BaseModel):
    lat: float
    lng: float


class FieldRequest(BaseModel):
    name: FieldName
    coordinates: list[CoordinateRequest] = Field(min_length=3, max_length=500)


class FieldRenameRequest(BaseModel):
    name: FieldName


class FieldHistoryRequest(BaseModel):
    last_crop_slug: str | None = None
    previous_crop_slugs: list[str] = Field(default_factory=list, max_length=10)


class FieldHistoryResponse(BaseModel):
    last_crop_slug: str | None = None
    previous_crop_slugs: list[str] = Field(default_factory=list)


class FieldResponse(BaseModel):
    id: int
    property_id: int
    name: str | None = None
    coordinates: list[CoordinateResponse]
    area_in_hectares: float
    history: FieldHistoryResponse
