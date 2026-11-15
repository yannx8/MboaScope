"""Tests for pipeline/import_giovanni.py. Owner: Data. No network."""
from __future__ import annotations

import csv
import json

import pytest

from pipeline import import_giovanni

SAMPLE = """title,Time Series, Area-Averaged of Merged satellite-gauge precipitation estimate monthly 0.1 deg. [GPM GPM_3IMERGM v07] mm/hr over 2001-01-01 - 2001-04-30, Region 9.6E, 3.9N, 9.9E, 4.2N
User Start Date,2001-01-01T00:00:00Z
User End Date,2001-04-30T23:59:59Z
Bounding Box,"9.6,3.9,9.9,4.2"
Fill Value (mean_GPM_3IMERGM_07_precipitation),-9999.9

time,mean_GPM_3IMERGM_07_precipitation
2001-01-01,0.0566
2001-02-01T00:00:00Z,0.0912
2001-03-01,-9999.9
2001-04-01,0.2731
"""


def read_rows(path):
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def test_parses_metadata_header_and_rows(tmp_path):
    src = tmp_path / "g.csv"
    src.write_text(SAMPLE, encoding="utf-8")
    import_giovanni.run(src, interim=tmp_path)
    rows = read_rows(tmp_path / "box_monthly_rate.csv")
    assert list(rows[0]) == ["month", "box", "rate", "units"]
    assert [r["month"] for r in rows] == ["2001-01", "2001-02", "2001-04"]  # fill value dropped, not filled
    assert rows[0] == {"month": "2001-01", "box": "box_3x3", "rate": "0.0566", "units": "mm/hr"}


def test_sources_untouched_without_activate(tmp_path):
    src = tmp_path / "g.csv"
    src.write_text(SAMPLE, encoding="utf-8")
    sources = tmp_path / "sources.json"
    sources.write_text('{"access_method": "earthaccess"}', encoding="utf-8")
    import_giovanni.run(src, interim=tmp_path)
    assert json.loads(sources.read_text(encoding="utf-8")) == {"access_method": "earthaccess"}


def test_activate_writes_plan_b_sources(tmp_path):
    src = tmp_path / "g.csv"
    src.write_text(SAMPLE, encoding="utf-8")
    import_giovanni.run(src, activate=True, interim=tmp_path)
    sources = json.loads((tmp_path / "sources.json").read_text(encoding="utf-8"))
    assert sources["access_method"] == "giovanni_csv"
    assert sources["source_units"] == "mm/hr"
    assert sources["period"] == {"start": "2001-01", "end": "2001-04"}
    assert "area average computed by Giovanni" in sources["notes"]


def test_missing_units_requires_flag():
    text = SAMPLE.replace(" mm/hr", "")
    with pytest.raises(ValueError, match="--units"):
        import_giovanni.parse(text)
    rows, units = import_giovanni.parse(text, units="mm/hr")
    assert units == "mm/hr" and len(rows) == 3


def test_no_header_raises():
    with pytest.raises(ValueError, match="time"):
        import_giovanni.parse("a,b\n1,2\n")
