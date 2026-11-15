from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.repositories import event_repository, measure_repository, station_repository
from saerpa_shared.schemas import (
    MeasureDataResponse,
    StationDataRequest,
    StationDataResponse,
)


def ingest_station_data(
    session: Session, payload: StationDataRequest
) -> StationDataResponse:
    timestamp = payload.timestamp_as_datetime()
    try:
        station = station_repository.get_by_unique_identifier(
            session, payload.unique_identifier
        )
        if station is None:
            station = station_repository.create(session, payload.unique_identifier)

        measure_results: list[MeasureDataResponse] = []
        for measure_data in payload.measures:
            measure = measure_repository.get_by_station_type_and_sensor(
                session, station.id, measure_data.type, measure_data.sensor_name
            )
            if measure is None:
                measure = measure_repository.create(
                    session,
                    station.id,
                    measure_data.type,
                    measure_data.sensor_name,
                    measure_data.measurement_unit,
                )
            elif measure.measurement_unit != measure_data.measurement_unit:
                measure.measurement_unit = measure_data.measurement_unit

            event_repository.create(
                session,
                station.id,
                measure.id,
                measure_data.type,
                measure_data.value,
                timestamp,
            )
            measure_results.append(
                MeasureDataResponse(
                    id=measure.id,
                    type=measure_data.type,
                    sensor_name=measure_data.sensor_name,
                    measurement_unit=measure_data.measurement_unit,
                    value=measure_data.value,
                )
            )

        response = StationDataResponse(
            station_id=station.id,
            unique_identifier=station.unique_identifier,
            timestamp=timestamp,
            measures=measure_results,
        )
        session.commit()
    except SQLAlchemyError as error:
        session.rollback()
        raise error

    return response
