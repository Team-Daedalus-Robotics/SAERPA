from pydantic import BaseModel, ConfigDict


class MeasureResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    station_id: int
    type: str
    sensor_name: str
    measurement_unit: str
    data_type: str
