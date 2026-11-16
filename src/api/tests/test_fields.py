import pytest
from fastapi.testclient import TestClient


def test_field_name_is_trimmed_and_validated(client: TestClient, property_id: int, square: list) -> None:
    path = f"/api/properties/{property_id}/fields"
    created = client.post(path, json={"name": "  Roça do fundo  ", "coordinates": square})
    assert created.status_code == 201
    assert created.json()["name"] == "Roça do fundo"
    assert created.json()["area_in_hectares"] > 0

    for invalid in ("", "   ", "a" * 129):
        assert client.post(path, json={"name": invalid, "coordinates": square}).status_code == 422


def test_crossing_outline_is_rejected(client: TestClient, property_id: int) -> None:
    bow_tie = [
        {"lat": -26.90, "lng": -48.66},
        {"lat": -26.91, "lng": -48.65},
        {"lat": -26.90, "lng": -48.65},
        {"lat": -26.91, "lng": -48.66},
    ]
    response = client.post(f"/api/properties/{property_id}/fields", json={"name": "X", "coordinates": bow_tie})
    assert response.status_code == 422


def test_rename_field(client: TestClient, property_id: int, square: list) -> None:
    field = client.post(f"/api/properties/{property_id}/fields", json={"name": "A", "coordinates": square}).json()
    renamed = client.patch(f"/api/fields/{field['id']}", json={"name": "  Canteiro das alfaces "})
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Canteiro das alfaces"
    assert renamed.json()["coordinates"] == field["coordinates"]

    for invalid in ({"name": ""}, {"name": "   "}, {}):
        assert client.patch(f"/api/fields/{field['id']}", json=invalid).status_code == 422
    assert client.patch("/api/fields/99999", json={"name": "x"}).status_code == 404


def test_history_is_replaced_and_validated(client: TestClient, property_id: int, square: list) -> None:
    field = client.post(f"/api/properties/{property_id}/fields", json={"name": "A", "coordinates": square}).json()
    saved = client.put(f"/api/fields/{field['id']}/history", json={"last_crop_slug": "acelga", "previous_crop_slugs": ["agriao"]})
    assert saved.status_code == 200
    assert saved.json()["history"] == {"last_crop_slug": "acelga", "previous_crop_slugs": ["agriao"]}

    replaced = client.put(f"/api/fields/{field['id']}/history", json={"last_crop_slug": None, "previous_crop_slugs": []})
    assert replaced.json()["history"]["last_crop_slug"] is None

    unknown = client.put(f"/api/fields/{field['id']}/history", json={"last_crop_slug": "nao-existe", "previous_crop_slugs": []})
    assert unknown.status_code == 404


def test_deleted_field_disappears_from_the_list(client: TestClient, property_id: int, square: list) -> None:
    field = client.post(f"/api/properties/{property_id}/fields", json={"name": "A", "coordinates": square}).json()
    assert client.delete(f"/api/fields/{field['id']}").status_code == 204
    assert client.get(f"/api/properties/{property_id}/fields").json() == []
    assert client.patch(f"/api/fields/{field['id']}", json={"name": "x"}).status_code == 404


@pytest.mark.parametrize("path", ["/api/crops"])
def test_crop_catalog_is_served(client: TestClient, path: str) -> None:
    crops = client.get(path).json()
    assert len(crops) > 40
    assert {"slug", "name", "emoji", "crop_group", "botanical_family", "planting_windows"} <= set(crops[0])
