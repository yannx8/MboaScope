"""Study configuration and runtime settings. Owner: Developer A (backend).

Scientific constants come from docs/methodology.md. Study regions live in
data/regions/cameroon_study_regions.json (owner: Developer A, GIS tasks), not here.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

# ------------------------------------------------------------------ paths
ROOT = Path(__file__).resolve().parents[3]  # repository root
DATA_DIR = ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
SAMPLE_DIR = DATA_DIR / "sample"
REGIONS_FILE = DATA_DIR / "regions" / "cameroon_study_regions.json"

# ------------------------------------------------------------------ science
API_VERSION = "2.0"
START_YEAR = 2001
END_YEAR = 2024  # IMERG V07 Final ends in 2025 before December (NASA moves to V08), so 2025 is incomplete
ALPHA = 0.05
MIN_YEARS = 10  # shortest period the trend tests accept

GRID_STEP = 0.1  # IMERG cell size in degrees
HEADLINE_BOX = "box_3x3"
BOX_SIZES = {"box_1x1": 1, "box_3x3": 3, "box_5x5": 5}
BOX_KM = {"box_1x1": 11, "box_3x3": 33, "box_5x5": 55}
SPATIAL_SIDE = 9  # the exploratory trend map covers 9 x 9 cells around the centre

DATASET = {
    "name": "GPM IMERG Final Precipitation L3 1 month 0.1 degree x 0.1 degree V07",
    "short_name": "GPM_3IMERGM",
    "version": "07",
    "doi": "10.5067/GPM/IMERG/3B-MONTH/07",
    "variable": "precipitation",
    "label": "IMERG V07",
}


# ------------------------------------------------------------------ runtime settings
def _load_dotenv() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:  # python-dotenv is optional at runtime
        return
    load_dotenv(ROOT / ".env")


@dataclass(frozen=True)
class Settings:
    db_path: Path
    gemini_api_key: str
    gemini_model: str
    cors_origins: list[str] = field(default_factory=list)


@lru_cache
def get_settings() -> Settings:
    _load_dotenv()
    origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    return Settings(
        db_path=Path(os.environ.get("MBOASCOPE_DB", PROCESSED_DIR / "mboascope.db")),
        gemini_api_key=os.environ.get("GEMINI_API_KEY", "").strip(),
        gemini_model=os.environ.get("GEMINI_MODEL", "").strip() or "gemini-3.6-flash",
        cors_origins=[o.strip() for o in origins.split(",") if o.strip()],
    )
