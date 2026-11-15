"""Tests for app/services/nasa/fetch_imerg.py against fake IMERG files. No network.

The fake granules copy the GES DISC layout of GPM_3IMERGM V07: group "Grid",
variable "precipitation" with dimensions (time, lon, lat), units "mm/hr",
fill value -9999.9. If task A1 finds the real files differ, update both.
"""
from __future__ import annotations

import sys
import types

import numpy as np
import pytest

xr = pytest.importorskip("xarray")
pytest.importorskip("h5netcdf")

from app.models import database as db  # noqa: E402
from app.services.nasa import fetch_imerg  # noqa: E402

FILL = -9999.9


def make_granule(path, rate: float, hole: tuple[float, float] | None = None) -> None:
    """A small IMERG-like file covering south and north Cameroon."""
    lat = np.round(np.arange(2.05, 11.0, 0.1), 2).astype("float32")
    lon = np.round(np.arange(9.05, 15.0, 0.1), 2).astype("float32")
    values = np.full((1, lon.size, lat.size), rate, dtype="float32")
    if hole:
        values[0, np.argmin(abs(lon - hole[1])), np.argmin(abs(lat - hole[0]))] = FILL
    da = xr.DataArray(
        values,
        dims=("time", "lon", "lat"),
        coords={"lon": lon, "lat": lat},
        attrs={"units": "mm/hr"},
        name="precipitation",
    )
    da.encoding["_FillValue"] = FILL
    ds = da.to_dataset()
    # Same time encoding as the real files: decoding it would need cftime.
    ds["time"] = ("time", np.array([1417392000], dtype="int32"), {
        "units": "seconds since 1980-01-06 00:00:00 UTC", "calendar": "julian", "standard_name": "time"})
    ds.to_netcdf(path, group="Grid", engine="h5netcdf")


class FakeGranule:
    def __init__(self, name: str):
        self.name = name

    def data_links(self):
        return [f"https://data.gesdisc.earthdata.nasa.gov/fake/{self.name}"]


@pytest.fixture
def fake_earthaccess(tmp_path, monkeypatch):
    names = [
        "3B-MO.MS.MRG.3IMERG.20250101-S000000-E235959.01.V07B.HDF5",
        "3B-MO.MS.MRG.3IMERG.20250201-S000000-E235959.02.V07B.HDF5",
    ]
    paths = []
    for i, name in enumerate(names):
        path = tmp_path / name
        make_granule(path, rate=0.1 * (i + 1))
        paths.append(str(path))

    fake = types.ModuleType("earthaccess")
    fake.calls = {}
    fake.login = lambda strategy: fake.calls.setdefault("login", strategy)

    def search_data(**kwargs):
        fake.calls["search"] = kwargs
        return [FakeGranule(n) for n in names]

    fake.search_data = search_data
    fake.open = lambda results: paths[: len(results)]
    by_name = dict(zip(names, paths))

    def download(granules, local_path):
        import shutil

        fake.calls.setdefault("downloaded", []).extend(g.name for g in granules)
        return [shutil.copy(by_name[g.name], local_path) for g in granules]

    fake.download = download
    monkeypatch.setitem(sys.modules, "earthaccess", fake)
    monkeypatch.setenv("EARTHDATA_USERNAME", "test-user")
    monkeypatch.setenv("EARTHDATA_PASSWORD", "test-pass")
    return fake


def test_month_from_granule_name():
    assert fetch_imerg._month_of("3B-MO.MS.MRG.3IMERG.20010101-S000000-E235959.01.V07B.HDF5") == "2001-01"


def test_fetch_stores_81_cells_per_region_per_month(tmp_db, fake_earthaccess):
    stored = fetch_imerg.fetch(["douala", "maroua"], start="2025-01", end="2025-02")
    assert stored == {"douala": 162, "maroua": 162}

    search = fake_earthaccess.calls["search"]
    assert search["short_name"] == "GPM_3IMERGM" and search["version"] == "07"
    west, south, east, north = search["bounding_box"]
    assert (west, south) == (9.3, 3.6) and (east, north) == (14.8, 11.0)

    obs = db.read_observations("douala")
    assert sorted(obs["month"].unique()) == ["2025-01", "2025-02"]
    assert set(obs["units"]) == {"mm/hr"}
    assert obs.loc[obs["month"] == "2025-02", "rate"].round(4).eq(0.2).all()
    assert {(4.05, 9.75), (3.65, 9.35), (4.45, 10.15)} <= set(zip(obs["lat"], obs["lon"]))

    source = db.get_source("douala")
    assert source["access_method"] == "earthaccess"
    assert (source["period_start"], source["period_end"]) == ("2025-01", "2025-02")
    assert source["granule_count"] == 2


def test_missing_login_gives_a_clear_message(fake_earthaccess, monkeypatch):
    monkeypatch.delenv("EARTHDATA_PASSWORD")
    monkeypatch.delenv("EARTHDATA_TOKEN", raising=False)
    with pytest.raises(SystemExit, match="EARTHDATA_PASSWORD not set"):
        fetch_imerg.login()


def test_duplicate_versions_keep_one_granule_per_month(tmp_db, fake_earthaccess):
    names = [
        "3B-MO.MS.MRG.3IMERG.20250101-S000000-E235959.01.V07A.HDF5",
        "3B-MO.MS.MRG.3IMERG.20250101-S000000-E235959.01.V07B.HDF5",
    ]
    kept = fetch_imerg.one_per_month([FakeGranule(n) for n in names])
    assert [g.name for g in kept] == [names[1]]


def test_fill_value_is_dropped_not_stored(tmp_path):
    path = tmp_path / "g.HDF5"
    make_granule(path, rate=0.3, hole=(4.05, 9.75))
    from app.services.gis.regions import get_region

    cells, units = fetch_imerg.read_cells(str(path), [get_region("douala")])
    df = cells["douala"]
    assert units == "mm/hr"
    assert len(df) == 80
    assert not ((df["lat"] == 4.05) & (df["lon"] == 9.75)).any()


def test_download_mode_reads_local_files_and_resumes(tmp_db, fake_earthaccess, tmp_path, monkeypatch):
    monkeypatch.setattr(fetch_imerg, "DOWNLOAD_DIR", tmp_path / "raw" / "imerg")
    assert fetch_imerg.fetch(["douala"], download=True) == {"douala": 162}
    assert len(fake_earthaccess.calls["downloaded"]) == 2
    fetch_imerg.fetch(["douala"], download=True)  # second run: nothing to download
    assert len(fake_earthaccess.calls["downloaded"]) == 2


def test_forbidden_gives_the_authorize_instruction():
    class Forbidden(Exception):
        status = 403

    with pytest.raises(SystemExit, match="NASA GESDISC DATA ARCHIVE"):
        fetch_imerg.explain_http_error(Forbidden("403, message='Forbidden'"))
    fetch_imerg.explain_http_error(ValueError("something else"))  # other errors pass through
