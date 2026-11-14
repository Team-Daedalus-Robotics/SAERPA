from datetime import datetime

from pydantic import BaseModel, ConfigDict


class StationRequest(BaseModel):
    unique_identifier: str


class StationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    unique_identifier: str
    created_at: datetime | None = None
