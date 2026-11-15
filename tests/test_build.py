"""Tests for pipeline/build.py. Owner: Lead. No network, no writes to the repo."""
from __future__ import annotations

import json
import shutil

from pipeline import build
from pipeline.common import WEB_DATA, write_json


def copy_web_data(tmp_path):
    for name in build.NAMES:
        shutil.copy(WEB_DATA / f"{name}.json", tmp_path / f"{name}.json")
    return json.loads((tmp_path / "annual.json").read_text(encoding="utf-8"))["is_mock"]


def test_committed_outputs_validate(tmp_path):
    mock = copy_web_data(tmp_path)
    assert build.validate_outputs(tmp_path, build.SCHEMAS, mock) == []


def test_mixed_mock_and_real_fails(tmp_path):
    mock = copy_web_data(tmp_path)
    problems = build.validate_outputs(tmp_path, build.SCHEMAS, not mock)
    assert len(problems) == 5 and all("mixed mock and real" in p for p in problems)


def test_schema_error_is_reported(tmp_path):
    mock = copy_web_data(tmp_path)
    path = tmp_path / "provenance.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    data["access_method"] = "made_up"
    path.write_text(json.dumps(data), encoding="utf-8")
    problems = build.validate_outputs(tmp_path, build.SCHEMAS, mock)
    assert any(p.startswith("provenance.json access_method") for p in problems)


def test_missing_file_is_reported(tmp_path):
    mock = copy_web_data(tmp_path)
    (tmp_path / "spatial.json").unlink()
    assert "spatial.json: missing" in build.validate_outputs(tmp_path, build.SCHEMAS, mock)


def test_provenance_for_plan_b_validates(tmp_path):
    copy_web_data(tmp_path)
    sources = {
        "access_method": "giovanni_csv",
        "source_units": "mm/hr",
        "period": {"start": "2001-01", "end": "2025-12"},
        "granules": [],
        "notes": ["area average computed by Giovanni"],
    }
    payload = build.provenance_payload(sources, "abc1234")
    assert payload["granule_count"] == 0 and payload["dataset"]["source_units"] == "mm/hr"
    write_json(tmp_path / "provenance.json", payload, is_mock=False)
    problems = build.validate_outputs(tmp_path, build.SCHEMAS, expected_mock=False)
    assert not [p for p in problems if p.startswith("provenance.json")]
