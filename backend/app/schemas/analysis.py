"""Trend and spatial results. Owner: Developer A. Rounding is done by the backend:
mm 0 dp, slopes 1 dp, p-values 3 dp, % 1 dp, correlations 2 dp. The frontend never recomputes."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from app.schemas.common import Envelope

Verdict = Literal["no_significant_trend", "significant_increase", "significant_decrease"]
TrendWord = Literal["increasing", "decreasing", "no trend"]


class MkOriginal(BaseModel):
    tau: float
    z: float
    p: float
    trend: TrendWord


class MkHamedRao(BaseModel):
    z: float
    p: float
    trend: TrendWord


class Pettitt(BaseModel):
    change_year: int  # first year of the new regime
    k: int
    p: float
    significant: bool


class Headline(BaseModel):
    region_id: str
    region_name: str
    box: str
    dataset: str
    period: str  # "2001-2024"
    n_years: int
    alpha: float
    mean_annual_mm: int
    lag1_autocorr: float
    autocorr_significant: bool
    mk_test_used: Literal["original", "hamed_rao"]
    mk_original: MkOriginal
    mk_hamed_rao: MkHamedRao
    sen_slope_mm_per_year: float
    sen_intercept_mm: int  # Sen line value at the first year: draw intercept + slope * (year - first)
    sen_ci95: list[float]
    pct_per_decade: float
    pettitt: Pettitt
    verdict: Verdict
    caveats: list[str]


class SensitivityRow(BaseModel):
    box: str
    dataset: str
    n_years: int
    p: float
    sen_slope_mm_per_year: float
    sen_ci95: list[float]
    verdict: Verdict


class TrendsResponse(Envelope):
    investigation_id: int
    headline: Headline
    sensitivity: list[SensitivityRow]


class SpatialCell(BaseModel):
    lat: float
    lon: float
    mean_annual_mm: int
    sen_slope_mm_per_year: float
    p: float


class SpatialResponse(Envelope):
    region_id: str
    grid_bounds: list[float]
    exploratory: bool
    available: bool
    n_cells: int
    alpha: float
    expected_false_positives: float
    n_significant: int
    cells: list[SpatialCell]


class InvestigationLog(BaseModel):
    id: int
    region_id: str
    start_year: int
    end_year: int
    verdict: Verdict
    p: float
    sen_slope_mm_per_year: float
    is_mock: bool
    created_at: str
