"""Fetch IMERG V07 monthly per-cell rates for the study regions (plan A). Owner: Developer A (task A1).

CLI: python -m app.cli fetch-imerg [--region douala ...] [--start 2001-01] [--end 2024-12] [--limit N]

STATUS: written from the GES DISC file layout but NOT yet run against NASA.
Task A1 starts with `python -m app.cli inspect-granule` on one granule to confirm
the group, variable, dimension order and units before running the full fetch.

How it works:
1. Log in to NASA Earthdata with EARTHDATA_USERNAME / EARTHDATA_PASSWORD from .env.
2. Search GPM_3IMERGM v07 granules over the union bounding box of the requested regions.
3. Open each granule remotely (earthaccess.open streams byte ranges, so only the
   Cameroon subset is transferred), read Grid/precipitation, keep the 9 x 9 cells of
   each region, and store the rates *as stored* with the file's units attribute.
4. Write one `sources` row per region with access_method "earthaccess".

Needs: pip install -r backend/requirements-fetch.txt
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from app.core.config import DATASET, END_YEAR, RAW_DIR, START_YEAR
from app.models import database as db
from app.services.gis.regions import Region, load_regions

GROUP = "Grid"
VARIABLE = "precipitation"
DOWNLOAD_DIR = RAW_DIR / "imerg"

FORBIDDEN_HINT = (
    "NASA refused the file (HTTP 403). Your login works, but your Earthdata account has not "
    "approved the GES DISC archive yet. Go to https://urs.earthdata.nasa.gov, open "
    "Applications > Authorized Apps, click APPROVE MORE APPLICATIONS, approve "
    "'NASA GESDISC DATA ARCHIVE', wait a minute, then run the command again. "
    "If it still fails, add --download."
)

EULA_HINT = (
    "NASA requires you to accept the GES DISC user agreement once. Open any IMERG file link in a "
    "browser, sign in with the same Earthdata account, click Authorize and Agree, then run the "
    "command again."
)


def explain_http_error(err: Exception) -> None:
    """Turn a 401/403 from the NASA file server into a readable instruction."""
    status = getattr(err, "status", None) or getattr(getattr(err, "response", None), "status_code", None)
    if type(err).__name__ == "EulaNotAccepted" or "Eula" in str(err):
        raise SystemExit(EULA_HINT) from err
    if status in (401, 403) or "403" in str(err) or "Forbidden" in str(err):
        raise SystemExit(FORBIDDEN_HINT) from err


def open_granules(results: list, download: bool = False) -> list:
    """File handles for the granules.

    Default: stream them (only the Cameroon part is transferred).
    download=True: save whole files in data/raw/imerg/ and read them locally. Files already
    there are skipped, so an interrupted run resumes where it stopped.
    """
    import earthaccess

    if not download:
        return earthaccess.open(results)
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    todo = [g for g in results if not (DOWNLOAD_DIR / _name_of(g)).exists()]
    if todo:
        print(f"download: {len(todo)} files to {DOWNLOAD_DIR} ({len(results) - len(todo)} already there)")
        try:
            earthaccess.download(todo, local_path=str(DOWNLOAD_DIR))
        except Exception as err:
            explain_http_error(err)
            raise
    missing = [_name_of(g) for g in results if not (DOWNLOAD_DIR / _name_of(g)).exists()]
    if missing:
        raise SystemExit(f"download incomplete, missing {len(missing)} files (first: {missing[0]}). "
                         "Run the same command again to resume. " + FORBIDDEN_HINT)
    return [str(DOWNLOAD_DIR / _name_of(g)) for g in results]


def login() -> None:
    """Log in to NASA Earthdata from EARTHDATA_USERNAME / EARTHDATA_PASSWORD (loaded from .env)."""
    import os

    import earthaccess

    missing = [k for k in ("EARTHDATA_USERNAME", "EARTHDATA_PASSWORD") if not os.environ.get(k)]
    if missing and not os.environ.get("EARTHDATA_TOKEN"):
        raise SystemExit(
            f"{' and '.join(missing)} not set. Put them in the .env file at the repository root "
            "(next to README.md), not in backend/."
        )
    earthaccess.login(strategy="environment")


def _union_bbox(regions: list[Region]) -> tuple[float, float, float, float]:
    """(west, south, east, north), the order earthaccess expects."""
    bounds = [r.grid_bounds for r in regions]
    return (
        min(b[2] for b in bounds),
        min(b[0] for b in bounds),
        max(b[3] for b in bounds),
        max(b[1] for b in bounds),
    )


def _month_of(granule_name: str) -> str:
    """'3B-MO.MS.MRG.3IMERG.20010101-S000000-E235959.01.V07B.HDF5' -> '2001-01'."""
    stamp = granule_name.split(".3IMERG.")[1][:8]
    return f"{stamp[:4]}-{stamp[4:6]}"


def _name_of(granule) -> str:
    return granule.data_links()[0].rsplit("/", 1)[-1]


def one_per_month(results: list) -> list:
    """Keep one granule per month. If a month appears twice (V07A and V07B), keep the later version."""
    best: dict[str, object] = {}
    for granule in results:
        name = _name_of(granule)
        month = _month_of(name)
        if month not in best or name > _name_of(best[month]):
            best[month] = granule
    return [best[m] for m in sorted(best)]


def open_grid(handle):
    """Open the Grid group. Times are not decoded: IMERG uses calendar 'julian', which needs
    cftime, and the month already comes from the file name."""
    import xarray as xr

    return xr.open_dataset(handle, group=GROUP, engine="h5netcdf", decode_times=False)


def read_cells(handle, regions: list[Region]) -> tuple[dict[str, pd.DataFrame], str]:
    """Per-region cell rates from one open granule. Returns ({region_id: df(lat, lon, rate)}, units)."""
    import xarray as xr

    ds = open_grid(handle)
    da = ds[VARIABLE].squeeze("time", drop=True)
    units = str(da.attrs.get("units", "")).strip()
    out = {}
    for region in regions:
        south, north, west, east = region.grid_bounds
        sub = da.sel(lat=slice(south, north), lon=slice(west, east)).load()
        df = sub.to_dataframe(name="rate").reset_index()[["lat", "lon", "rate"]]
        df["lat"] = df["lat"].round(2)
        df["lon"] = df["lon"].round(2)
        df = df[np.isfinite(df["rate"]) & (df["rate"] >= 0)]  # fill values dropped, never filled
        out[region.id] = df
    ds.close()
    return out, units


def fetch(
    region_ids: list[str] | None = None,
    start: str = f"{START_YEAR}-01",
    end: str = f"{END_YEAR}-12",
    limit: int | None = None,
    db_path: Path | None = None,
    download: bool = False,
) -> dict[str, int]:
    import earthaccess

    regions_all = load_regions()
    regions = [regions_all[r] for r in (region_ids or list(regions_all))]
    login()
    results = earthaccess.search_data(
        short_name=DATASET["short_name"],
        version=DATASET["version"],
        temporal=(f"{start}-01", f"{end}-28"),
        bounding_box=_union_bbox(regions),
    )
    results = one_per_month(results)
    if limit:
        results = results[:limit]
    print(f"fetch-imerg: {len(results)} granules for {', '.join(r.id for r in regions)}")

    frames: dict[str, list[pd.DataFrame]] = {r.id: [] for r in regions}
    names: list[str] = []
    units_seen: set[str] = set()
    for granule, handle in zip(results, open_granules(results, download)):
        name = _name_of(granule)
        month = _month_of(name)
        try:
            cells, units = read_cells(handle, regions)
        except Exception as err:
            explain_http_error(err)
            raise
        units_seen.add(units)
        names.append(name)
        for rid, df in cells.items():
            frames[rid].append(df.assign(month=month, units=units))
        print(f"  {month}: ok ({units})")
    if len(units_seen) != 1:
        raise ValueError(f"granules disagree on units: {units_seen}")

    source_units = next(iter(units_seen))
    stored = {}
    months = sorted(_month_of(n) for n in names)
    for rid, parts in frames.items():
        df = pd.concat(parts, ignore_index=True)[["month", "lat", "lon", "rate", "units"]]
        stored[rid] = db.replace_observations(rid, df, db_path)
        db.upsert_source(
            rid,
            {
                "access_method": "earthaccess",
                "source_units": source_units,
                "period": {"start": months[0], "end": months[-1]},
                "granule_count": len(names),
                "notes": [f"{DATASET['short_name']} v{DATASET['version']} via earthaccess"],
            },
            db_path,
        )
    return stored
