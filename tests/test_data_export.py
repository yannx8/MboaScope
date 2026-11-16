"""Task A5: export the database to committed files and rebuild it from them. No network."""
from fastapi.testclient import TestClient

from app import main
from app.models import database as db
from app.services.nasa import mock


def test_export_then_load_gives_the_same_rows(tmp_db, tmp_path):
    mock.seed_all(["douala", "maroua"])
    counts = db.export_data(tmp_path / "out")
    assert counts["sources"] == 2 and counts["observations"] > 0

    fresh = tmp_path / "fresh.db"
    assert db.is_empty(fresh)
    assert db.load_data(tmp_path / "out", fresh) == counts
    for rid in ("douala", "maroua"):
        assert db.read_observations(rid).equals(db.read_observations(rid, fresh))
        assert db.get_source(rid, fresh)["access_method"] == "mock"  # mock stays flagged


def test_fresh_database_plus_load_gives_the_same_trend(tmp_db, tmp_path, monkeypatch):
    mock.seed_all(["garoua"])
    request = {"region_id": "garoua", "start_year": 2001, "end_year": 2024}
    before = TestClient(main.app).post("/api/analysis/trends", json=request).json()
    db.export_data(tmp_path / "out")

    from app.core import config
    from app.services import investigation

    monkeypatch.setenv("MBOASCOPE_DB", str(tmp_path / "fresh.db"))
    config.get_settings.cache_clear()
    investigation.clear_cache()
    assert main.load_shipped_data(tmp_path / "out") is True  # what start-up does
    assert main.load_shipped_data(tmp_path / "out") is False  # not empty any more
    after = TestClient(main.app).post("/api/analysis/trends", json=request).json()
    assert before["headline"]["n_years"] == 24
    for key in ("headline", "sensitivity"):
        assert after[key] == before[key]
    assert after["is_mock"] is True
