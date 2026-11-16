from fastapi.testclient import TestClient
from sqlalchemy import text

from saerpa_shared.engine import engine
from tests.conftest import shifted_square


def count(query: str) -> int:
    with engine.connect() as connection:
        return connection.execute(text(query)).scalar_one()


def test_property_is_created_and_read(client: TestClient, property_id: int) -> None:
    response = client.get(f"/api/properties/{property_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Itajaí"


def test_unknown_property_returns_404(client: TestClient) -> None:
    assert client.get("/api/properties/99999").status_code == 404
    assert client.delete("/api/properties/99999").status_code == 404


def test_deleting_a_property_removes_its_fields_and_history(client: TestClient, property_id: int, square: list) -> None:
    other_id = client.post("/api/properties", json={"name": "Campinas", "lat": -22.9, "lng": -47.06}).json()["id"]
    first = client.post(f"/api/properties/{property_id}/fields", json={"name": "A", "coordinates": square}).json()
    second = client.post(f"/api/properties/{property_id}/fields", json={"name": "B", "coordinates": shifted_square(0.05)}).json()
    kept = client.post(f"/api/properties/{other_id}/fields", json={"name": "C", "coordinates": shifted_square(2)}).json()
    for field in (first, kept):
        history = client.put(f"/api/fields/{field['id']}/history", json={"last_crop_slug": "acelga", "previous_crop_slugs": ["agriao"]})
        assert history.status_code == 200
    assert second["id"]

    assert client.delete(f"/api/properties/{property_id}").status_code == 204

    assert client.get(f"/api/properties/{property_id}").status_code == 404
    assert client.get(f"/api/properties/{property_id}/fields").status_code == 404
    assert client.post(f"/api/properties/{property_id}/fields", json={"name": "x", "coordinates": square}).status_code == 404
    assert client.patch(f"/api/fields/{first['id']}", json={"name": "x"}).status_code == 404
    assert client.delete(f"/api/properties/{property_id}").status_code == 404
    assert count(f"SELECT count(*) FROM field WHERE property_id = {property_id} AND deleted IS NOT TRUE") == 0
    assert count(f"SELECT count(*) FROM planting WHERE field_id IN ({first['id']}, {second['id']}) AND deleted IS NOT TRUE") == 0
    assert client.get(f"/api/properties/{other_id}/fields").json()[0]["history"]["last_crop_slug"] == "acelga"
    assert count(f"SELECT count(*) FROM property WHERE id = {property_id}") == 1


def test_property_location_follows_the_center_of_its_fields(client: TestClient, property_id: int, square: list) -> None:
    client.post(f"/api/properties/{property_id}/fields", json={"name": "A", "coordinates": square})
    location = client.get(f"/api/properties/{property_id}").json()
    assert abs(location["lat"] - (-26.905)) < 0.001
    assert abs(location["lng"] - (-48.655)) < 0.001
