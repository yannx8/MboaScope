"""SQLite storage. Owner: Developer A.

Four tables, nothing more (see docs/architecture.md):

- observations      per-cell monthly rates, exactly as NASA stores them (plan A, mock)
- box_observations  area-averaged monthly rates from Giovanni (plan B)
- sources           one row per region: how its data arrived (the run switch)
- investigations    a log of every trend investigation the API has run
- ai_explanations   Gemini rewrites that passed every check (cache, task B8, owner B)
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
CREATE TABLE IF NOT EXISTS ai_explanations (
    region_id     TEXT NOT NULL,
    start_year    INTEGER NOT NULL,
    end_year      INTEGER NOT NULL,
    analysis_hash TEXT NOT NULL,      -- sha256 of the analysis without generated_at
    payload       TEXT NOT NULL,      -- JSON explanation, source gemini
    created_at    TEXT NOT NULL,
    PRIMARY KEY (region_id, start_year, end_year, analysis_hash)
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


# ------------------------------------------------------------------ AI cache (task B8, owner B)
def save_ai_explanation(
    region_id: str, start_year: int, end_year: int, analysis_hash: str, payload: dict[str, Any], db_path: Path | None = None
) -> None:
    with connect(db_path) as conn:
        conn.execute(
            "INSERT OR REPLACE INTO ai_explanations VALUES (?, ?, ?, ?, ?, ?)",
            (region_id, start_year, end_year, analysis_hash, json.dumps(payload, ensure_ascii=False), now_utc()),
        )


def get_ai_explanation(
    region_id: str, start_year: int, end_year: int, analysis_hash: str, db_path: Path | None = None
) -> dict[str, Any] | None:
    with connect(db_path) as conn:
        row = conn.execute(
            "SELECT payload FROM ai_explanations WHERE region_id = ? AND start_year = ? AND end_year = ? AND analysis_hash = ?",
            (region_id, start_year, end_year, analysis_hash),
        ).fetchone()
    return json.loads(row["payload"]) if row else None


def delete_ai_explanation(
    region_id: str, start_year: int, end_year: int, analysis_hash: str, db_path: Path | None = None
) -> None:
    with connect(db_path) as conn:
        conn.execute(
            "DELETE FROM ai_explanations WHERE region_id = ? AND start_year = ? AND end_year = ? AND analysis_hash = ?",
            (region_id, start_year, end_year, analysis_hash),
        )
