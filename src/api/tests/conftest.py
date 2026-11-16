import os
from collections.abc import Iterator

import pytest

if not os.environ.get("DATABASE_URL"):
    pytest.skip("DATABASE_URL (PostgreSQL with PostGIS) is required to run the API tests.", allow_module_level=True)

from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from saerpa_shared.engine import engine

SQUARE = [
    {"lat": -26.90, "lng": -48.66},
    {"lat": -26.90, "lng": -48.65},
    {"lat": -26.91, "lng": -48.65},
    {"lat": -26.91, "lng": -48.66},
]


@pytest.fixture(scope="session")
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def clean_tables(client: TestClient) -> None:
    with engine.begin() as connection:
        connection.execute(text("TRUNCATE planting, field, property, climate_cell RESTART IDENTITY CASCADE"))


@pytest.fixture
def property_id(client: TestClient) -> int:
    response = client.post("/api/properties", json={"name": "Itajaí", "lat": -26.9078, "lng": -48.6619})
    assert response.status_code == 201
    return response.json()["id"]


@pytest.fixture
def square() -> list[dict[str, float]]:
    return [dict(point) for point in SQUARE]


def shifted_square(latitude_offset: float) -> list[dict[str, float]]:
    return [{"lat": point["lat"] - latitude_offset, "lng": point["lng"]} for point in SQUARE]
