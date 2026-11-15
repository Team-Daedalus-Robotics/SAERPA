from datetime import date, datetime

from pydantic import BaseModel


class DailyValueResponse(BaseModel):
    date: date
    value: float


class ClimateMetricResponse(BaseModel):
    latest: float
    average: float
    daily: list[DailyValueResponse]


class RainfallResponse(BaseModel):
    last_24_hours_millimeters: float
    last_7_days_millimeters: float
    last_30_days_millimeters: float
    daily: list[DailyValueResponse]


class ClimateCellResponse(BaseModel):
    latitude: float
    longitude: float
    south: float
    west: float
    north: float
    east: float


class ClimateResponse(BaseModel):
    source: str
    cell: ClimateCellResponse
    updated_through: datetime
    soil_moisture_percent: ClimateMetricResponse
    soil_temperature_celsius: ClimateMetricResponse
    air_temperature_celsius: ClimateMetricResponse
    air_humidity_percent: ClimateMetricResponse
    rainfall: RainfallResponse
