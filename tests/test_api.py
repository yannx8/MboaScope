"""End-to-end tests of the six API endpoints on mock data. No network."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.nasa import mock


@pytest.fixture
def client(tmp_db):
    mock.seed_all(["douala", "maroua"])
    return TestClient(app)


def test_health(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["regions_with_data"] == ["douala", "maroua"]
    assert body["is_mock"] is True


def test_regions_lists_all_and_flags_data(client):
    regions = {r["id"]: r for r in client.get("/api/regions").json()["regions"]}
    assert len(regions) == 10
    assert regions["douala"]["has_data"] is True
    assert regions["yaounde"]["has_data"] is False
    assert regions["douala"]["boxes"]["box_3x3"]["bounds"] == [3.9, 4.2, 9.6, 9.9]


def test_rainfall_series(client):
    body = client.post("/api/rainfall/series", json={"region_id": "douala", "start_year": 2005, "end_year": 2020}).json()
    assert body["is_mock"] is True
    assert [y["year"] for y in body["years"]] == list(range(2005, 2021))
    assert len(body["climatology"]) == 12
    assert body["provenance"]["access_method"] == "mock"


def test_trends_and_history(client):
    body = client.post("/api/analysis/trends", json={"region_id": "maroua"}).json()
    h = body["headline"]
    assert h["region_name"] == "Maroua" and h["period"] == "2001-2024"
    assert "coastal_skill" not in h["caveats"]
    assert [r["box"] for r in body["sensitivity"]] == ["box_1x1", "box_5x5"]
    history = client.get("/api/analysis/history").json()
    assert history[0]["id"] == body["investigation_id"]


def test_spatial(client):
    body = client.post("/api/analysis/spatial", json={"region_id": "douala"}).json()
    assert body["available"] is True and body["n_cells"] == 81
    assert body["expected_false_positives"] == 4.05


def test_interpret_template(client):
    body = client.post("/api/ai/interpret", json={"region_id": "douala"}).json()
    assert body["explanation"]["source"] == "template"
    assert body["explanation"]["checks_passed"] is True
    assert "Douala" in body["explanation"]["summary"]
    assert len(body["explanation"]["limitations"]) == 4
    assert body["suggestions"]


@pytest.mark.parametrize(
    "payload, status",
    [
        ({"region_id": "paris"}, 404),
        ({"region_id": "yaounde"}, 409),  # exists, no data ingested
        ({"region_id": "douala", "start_year": 2020, "end_year": 2025}, 422),  # fewer than 10 years
        ({"region_id": "douala", "start_year": 2015, "end_year": 2005}, 422),
        ({"region_id": "douala", "start_year": 1990}, 422),
    ],
)
def test_errors_are_clean(client, payload, status):
    response = client.post("/api/analysis/trends", json=payload)
    assert response.status_code == status
    assert "detail" in response.json()
