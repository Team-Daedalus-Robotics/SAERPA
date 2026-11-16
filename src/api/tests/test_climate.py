from fastapi.testclient import TestClient
from sqlalchemy import text

from saerpa_shared.engine import engine


def scalar(query: str) -> int:
    with engine.connect() as connection:
        return connection.execute(text(query)).scalar_one()


def test_new_place_is_pending_and_the_api_writes_no_event(client: TestClient) -> None:
    response = client.get("/api/climate", params={"lat": -26.9078, "lng": -48.6619})
    assert response.status_code == 202
    assert response.json()["status"] == "pending"
    assert scalar("SELECT count(*) FROM climate_cell") == 1
    assert scalar("SELECT count(*) FROM event") == 0
    assert scalar("SELECT count(*) FROM station WHERE unique_identifier LIKE 'nasa-power-%'") == 0


def test_points_in_the_same_nasa_cell_share_one_request(client: TestClient) -> None:
    client.get("/api/climate", params={"lat": -26.9078, "lng": -48.6619})
    client.get("/api/climate", params={"lat": -26.8943, "lng": -48.6546})
    assert scalar("SELECT count(*) FROM climate_cell") == 1


def test_invalid_coordinates_are_rejected(client: TestClient) -> None:
    assert client.get("/api/climate", params={"lat": 91, "lng": 0}).status_code == 422
    assert client.get("/api/climate", params={"lat": 0, "lng": 181}).status_code == 422
