"""SQLite storage. Owner: Developer A.

Four tables, nothing more (see docs/architecture.md):

- observations      per-cell monthly rates, exactly as NASA stores them (plan A, mock)
- box_observations  area-averaged monthly rates from Giovanni (plan B)
- sources           one row per region: how its data arrived (the run switch)
- investigations    a log of every trend investigation the API has run
"""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

import pandas as pd

from app.core.config import get_settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS observations (
    region_id TEXT NOT NULL,
    month     TEXT NOT NULL,          -- YYYY-MM
    lat       REAL NOT NULL,          -- cell centre, 2 decimals
    lon       REAL NOT NULL,
    rate      REAL NOT NULL,          -- as stored in the NASA file, no conversion
    units     TEXT NOT NULL,          -- the file's units attribute, e.g. mm/hr
    PRIMARY KEY (region_id, month, lat, lon)
);
CREATE TABLE IF NOT EXISTS box_observations (
    region_id TEXT NOT NULL,
    month     TEXT NOT NULL,
    box       TEXT NOT NULL,          -- always box_3x3 for Giovanni
    rate      REAL NOT NULL,
    units     TEXT NOT NULL,
    PRIMARY KEY (region_id, month, box)
);
CREATE TABLE IF NOT EXISTS sources (
    region_id      TEXT PRIMARY KEY,
    access_method  TEXT NOT NULL,     -- mock | earthaccess | giovanni_csv
    source_units   TEXT NOT NULL,
    period_start   TEXT NOT NULL,
    period_end     TEXT NOT NULL,
    granule_count  INTEGER NOT NULL DEFAULT 0,
    notes          TEXT NOT NULL DEFAULT '[]',   -- JSON list of strings
    updated_at     TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS investigations (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    region_id             TEXT NOT NULL,
    start_year            INTEGER NOT NULL,
    end_year              INTEGER NOT NULL,
    verdict               TEXT NOT NULL,
    p                     REAL NOT NULL,
    sen_slope_mm_per_year REAL NOT NULL,
    is_mock               INTEGER NOT NULL,
    created_at            TEXT NOT NULL
);
"""


def now_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@contextmanager
def connect(db_path: Path | None = None) -> Iterator[sqlite3.Connection]:
    path = Path(db_path or get_settings().db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    try:
        conn.executescript(SCHEMA)
        yield conn
        conn.commit()
    finally:
        conn.close()


# ------------------------------------------------------------------ writes
def replace_observations(region_id: str, df: pd.DataFrame, db_path: Path | None = None) -> int:
    """Replace every per-cell observation of a region. df: month, lat, lon, rate, units."""
    rows = [
        (region_id, str(r.month), round(float(r.lat), 2), round(float(r.lon), 2), float(r.rate), str(r.units))
        for r in df.itertuples(index=False)
    ]
    with connect(db_path) as conn:
        conn.execute("DELETE FROM observations WHERE region_id = ?", (region_id,))
        conn.executemany("INSERT INTO observations VALUES (?, ?, ?, ?, ?, ?)", rows)
    return len(rows)


def replace_box_observations(region_id: str, rows: list[dict], db_path: Path | None = None) -> int:
    with connect(db_path) as conn:
        conn.execute("DELETE FROM box_observations WHERE region_id = ?", (region_id,))
        conn.executemany(
            "INSERT INTO box_observations VALUES (?, ?, ?, ?, ?)",
            [(region_id, r["month"], r["box"], float(r["rate"]), r["units"]) for r in rows],
        )
    return len(rows)


def upsert_source(region_id: str, source: dict[str, Any], db_path: Path | None = None) -> None:
    with connect(db_path) as conn:
        conn.execute(
            """INSERT INTO sources VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(region_id) DO UPDATE SET
                 access_method=excluded.access_method, source_units=excluded.source_units,
                 period_start=excluded.period_start, period_end=excluded.period_end,
                 granule_count=excluded.granule_count, notes=excluded.notes, updated_at=excluded.updated_at""",
            (
                region_id,
                source["access_method"],
                source["source_units"],
                source["period"]["start"],
                source["period"]["end"],
                int(source.get("granule_count", 0)),
                json.dumps(source.get("notes", [])),
                now_utc(),
            ),
        )


def log_investigation(record: dict[str, Any], db_path: Path | None = None) -> int:
    """Log an investigation; repeated calls for the same one (several pages) reuse the last row."""
    with connect(db_path) as conn:
        last = conn.execute("SELECT * FROM investigations ORDER BY id DESC LIMIT 1").fetchone()
        if last is not None and all(
            last[k] == record[k] for k in ("region_id", "start_year", "end_year", "verdict")
        ) and bool(last["is_mock"]) == bool(record["is_mock"]):
            return int(last["id"])
        cur = conn.execute(
            """INSERT INTO investigations
               (region_id, start_year, end_year, verdict, p, sen_slope_mm_per_year, is_mock, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                record["region_id"],
                record["start_year"],
                record["end_year"],
                record["verdict"],
                record["p"],
                record["sen_slope_mm_per_year"],
                int(record["is_mock"]),
                now_utc(),
            ),
        )
        return int(cur.lastrowid)


# ------------------------------------------------------------------ reads
def get_source(region_id: str, db_path: Path | None = None) -> dict[str, Any] | None:
    with connect(db_path) as conn:
        row = conn.execute("SELECT * FROM sources WHERE region_id = ?", (region_id,)).fetchone()
    if row is None:
        return None
    out = dict(row)
    out["notes"] = json.loads(out["notes"])
    return out


def all_sources(db_path: Path | None = None) -> dict[str, dict[str, Any]]:
    with connect(db_path) as conn:
        rows = conn.execute("SELECT * FROM sources").fetchall()
    return {r["region_id"]: {**dict(r), "notes": json.loads(r["notes"])} for r in rows}


def read_observations(region_id: str, db_path: Path | None = None) -> pd.DataFrame:
    with connect(db_path) as conn:
        return pd.read_sql_query(
            "SELECT month, lat, lon, rate, units FROM observations WHERE region_id = ? ORDER BY month, lat, lon",
            conn,
            params=(region_id,),
        )


def read_box_observations(region_id: str, db_path: Path | None = None) -> pd.DataFrame:
    with connect(db_path) as conn:
        return pd.read_sql_query(
            "SELECT month, box, rate, units FROM box_observations WHERE region_id = ? ORDER BY month",
            conn,
            params=(region_id,),
        )


def recent_investigations(limit: int = 20, db_path: Path | None = None) -> list[dict[str, Any]]:
    with connect(db_path) as conn:
        rows = conn.execute("SELECT * FROM investigations ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    return [{**dict(r), "is_mock": bool(r["is_mock"])} for r in rows]


# ------------------------------------------------------------------ ship the data (task A5)
# The SQLite file is gitignored. These files are committed instead, and the database is
# rebuilt from them with `python -m app.cli load` or automatically at server start-up.
OBSERVATIONS_FILE = "observations.csv.gz"
BOX_OBSERVATIONS_FILE = "box_observations.csv.gz"
SOURCES_FILE = "sources.json"


def is_empty(db_path: Path | None = None) -> bool:
    """True when no region has any data source yet."""
    with connect(db_path) as conn:
        return conn.execute("SELECT COUNT(*) FROM sources").fetchone()[0] == 0


def export_data(folder: Path, db_path: Path | None = None) -> dict[str, int]:
    """Write observations, box observations and sources to `folder`. Returns row counts.

    Rates are written exactly as stored (no rounding, no unit conversion). Each source keeps
    its access_method, so mock data stays flagged as mock after a load.
    """
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    with connect(db_path) as conn:
        obs = pd.read_sql_query(
            "SELECT region_id, month, lat, lon, rate, units FROM observations "
            "ORDER BY region_id, month, lat, lon", conn)
        box = pd.read_sql_query(
            "SELECT region_id, month, box, rate, units FROM box_observations "
            "ORDER BY region_id, month, box", conn)
        sources = [dict(r) for r in conn.execute("SELECT * FROM sources ORDER BY region_id").fetchall()]
    for s in sources:
        s["notes"] = json.loads(s["notes"])
    obs.to_csv(folder / OBSERVATIONS_FILE, index=False, compression={"method": "gzip", "mtime": 0})
    if len(box):
        box.to_csv(folder / BOX_OBSERVATIONS_FILE, index=False, compression={"method": "gzip", "mtime": 0})
    else:
        (folder / BOX_OBSERVATIONS_FILE).unlink(missing_ok=True)
    (folder / SOURCES_FILE).write_text(json.dumps(sources, indent=2) + "\n", encoding="utf-8")
    return {"observations": len(obs), "box_observations": len(box), "sources": len(sources)}


def load_data(folder: Path, db_path: Path | None = None) -> dict[str, int]:
    """Rebuild observations, box observations and sources from files written by export_data.

    Regions in the files replace the same regions in the database; other regions are kept.
    """
    folder = Path(folder)
    sources_path = folder / SOURCES_FILE
    if not sources_path.exists():
        raise FileNotFoundError(f"{sources_path} not found. Run `python -m app.cli export` first.")
    sources = json.loads(sources_path.read_text(encoding="utf-8"))
    obs_path = folder / OBSERVATIONS_FILE
    box_path = folder / BOX_OBSERVATIONS_FILE
    obs = pd.read_csv(obs_path, dtype={"month": str}) if obs_path.exists() else pd.DataFrame()
    box = pd.read_csv(box_path, dtype={"month": str}) if box_path.exists() else pd.DataFrame()

    counts = {"observations": 0, "box_observations": 0, "sources": 0}
    for s in sources:
        rid = s["region_id"]
        if len(obs):
            part = obs[obs["region_id"] == rid]
            counts["observations"] += replace_observations(rid, part[["month", "lat", "lon", "rate", "units"]], db_path)
        if len(box):
            part = box[box["region_id"] == rid]
            counts["box_observations"] += replace_box_observations(rid, part.to_dict("records"), db_path)
        upsert_source(
            rid,
            {
                "access_method": s["access_method"],
                "source_units": s["source_units"],
                "period": {"start": s["period_start"], "end": s["period_end"]},
                "granule_count": s["granule_count"],
                "notes": s["notes"],
            },
            db_path,
        )
        counts["sources"] += 1
    return counts
