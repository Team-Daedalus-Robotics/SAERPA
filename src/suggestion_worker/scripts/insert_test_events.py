import argparse
from datetime import datetime, timedelta, timezone

from sqlalchemy import insert, select

from db.tables import event_table
from saerpa_shared.engine import SessionLocal
from saerpa_shared.models import Measure, Station


def insert_test_events(count: int) -> int:
    if count < 1:
        raise ValueError("The event count must be greater than zero.")

    with SessionLocal.begin() as session:
        station = session.scalar(
            select(Station).where(Station.unique_identifier == "test-station-001")
        )
        if station is None:
            station = Station(unique_identifier="test-station-001")
            session.add(station)
            session.flush()

        measure = session.scalar(
            select(Measure).where(
                Measure.station_id == station.id,
                Measure.sensor_name == "Test temperature sensor",
            )
        )
        if measure is None:
            measure = Measure(
                station_id=station.id,
                type="temperature",
                sensor_name="Test temperature sensor",
                measurement_unit="°C",
                data_type="float",
            )
            session.add(measure)
            session.flush()

        now = datetime.now(timezone.utc)
        event_records = [
            {
                "timestamp": now - timedelta(minutes=count - index - 1),
                "station_id": station.id,
                "measure_id": measure.id,
                "measure_type": "temperature",
                "value": f"{20.0 + (index % 10) * 0.5:.1f}",
            }
            for index in range(count)
        ]
        session.execute(insert(event_table), event_records)

    return count


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Insert test temperature readings into the event table."
    )
    parser.add_argument(
        "--count",
        type=int,
        default=10,
        help="Number of events to insert (default: 10).",
    )
    arguments = parser.parse_args()

    inserted_count = insert_test_events(arguments.count)
    print(f"Inserted {inserted_count} test events.", flush=True)


if __name__ == "__main__":
    main()
