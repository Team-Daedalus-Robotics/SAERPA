from sqlalchemy import select
from sqlalchemy.orm import Session

from saerpa_shared.models import Measure


def get_by_station_type_and_sensor(
    session: Session, station_id: int, type: str, sensor_name: str
) -> Measure | None:
    statement = select(Measure).where(
        Measure.station_id == station_id,
        Measure.type == type,
        Measure.sensor_name == sensor_name,
    )
    return session.scalars(statement).first()


def create(
    session: Session,
    station_id: int,
    type: str,
    sensor_name: str,
    measurement_unit: str,
    data_type: str = "number",
) -> Measure:
    measure = Measure(
        station_id=station_id,
        type=type,
        sensor_name=sensor_name,
        measurement_unit=measurement_unit,
        data_type=data_type,
    )
    session.add(measure)
    session.flush()
    return measure
