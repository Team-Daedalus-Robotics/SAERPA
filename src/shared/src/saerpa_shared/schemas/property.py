from pydantic import BaseModel, ConfigDict, Field


class PropertyRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class PropertyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    lat: float
    lng: float
