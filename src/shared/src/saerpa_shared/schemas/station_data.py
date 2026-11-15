from datetime import datetime, timezone

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class MeasureDataRequest(BaseModel):
    value: str
    type: str
    sensor_name: str = Field(
        validation_alias=AliasChoices("sensor_name", "sensorType"),
    )
    measurement_unit: str = Field(
        default="",
        validation_alias=AliasChoices("measurement_unit", "measureUnit"),
    )


class StationDataRequest(BaseModel):
    unique_identifier: str = Field(
        validation_alias=AliasChoices("unique_identifier", "IdUnicoEstacao"),
    )
    timestamp: int
    measures: list[MeasureDataRequest] = Field(
        validation_alias=AliasChoices("measures", "medidas"),
    )

    def timestamp_as_datetime(self) -> datetime:
        return datetime.fromtimestamp(self.timestamp, tz=timezone.utc)


class MeasureDataResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    sensor_name: str
    measurement_unit: str
    value: str


class StationDataResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    station_id: int
    unique_identifier: str
    timestamp: datetime
    measures: list[MeasureDataResponse]
