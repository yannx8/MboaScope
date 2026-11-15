"""Task A6: check stats.mk_hamed_rao against an independent implementation of
Hamed and Rao (1998), "A modified Mann-Kendall trend test for autocorrelated data",
Journal of Hydrology 204, 182-196. Written from the paper's formulas, without pymannkendall.
"""
import math

import numpy as np
from scipy.stats import norm, rankdata

from app.services.analytics import stats


def hamed_rao_by_hand(x, alpha=0.05):
    x = np.asarray(x, dtype=float)
    n = len(x)
    # Mann-Kendall S and its variance without ties
    s = sum(np.sign(x[j] - x[i]) for i in range(n) for j in range(i + 1, n))
    var_s = n * (n - 1) * (2 * n + 5) / 18
    # 1. remove the trend with Sen's slope (median of all pairwise slopes)
    slopes = [(x[j] - x[i]) / (j - i) for i in range(n) for j in range(i + 1, n)]
    detrended = x - np.arange(1, n + 1) * np.median(slopes)
    # 2. autocorrelation of the ranks of the detrended series
    r = rankdata(detrended)
    d = r - r.mean()
    rho = [np.sum(d[: n - k] * d[k:]) / np.sum(d * d) for k in range(n)]
    # 3. keep only lags whose autocorrelation is significant at alpha
    bound = norm.ppf(1 - alpha / 2) / math.sqrt(n)
    total = sum((n - k) * (n - k - 1) * (n - k - 2) * rho[k] for k in range(1, n) if abs(rho[k]) > bound)
    # 4. correction factor n/n* and corrected variance (paper, equation 22)
    factor = 1 + 2 / (n * (n - 1) * (n - 2)) * total
    var_corrected = var_s * factor
    # 5. Z with continuity correction, two-sided p
    z = (s - np.sign(s)) / math.sqrt(var_corrected) if s != 0 else 0.0
    p = 2 * (1 - norm.cdf(abs(z)))
    return z, p, factor


def autocorrelated_series(n=24, phi=0.7, seed=3):
    """An AR(1) series plus a weak trend, like 24 annual rainfall totals in mm."""
    rng = np.random.default_rng(seed)
    e = np.zeros(n)
    for t in range(1, n):
        e[t] = phi * e[t - 1] + rng.normal(0, 150)
    return 1800 + 8 * np.arange(n) + e


def test_hamed_rao_matches_the_paper_formula():
    x = autocorrelated_series()
    z, p, factor = hamed_rao_by_hand(x)
    assert factor != 1.0  # the correction is really applied on this series
    lib = stats.mk_hamed_rao(x)
    assert abs(lib["z"] - z) < 1e-9
    assert abs(lib["p"] - p) < 1e-9


def test_hamed_rao_differs_from_the_original_test_when_autocorrelated():
    """Guards the old bug where mk_hamed_rao ran the original test."""
    x = autocorrelated_series()
    assert abs(stats.mk_hamed_rao(x)["z"] - stats.mk_original(x)["z"]) > 1e-6


def test_hamed_rao_matches_on_several_series():
    for seed in range(10):
        x = autocorrelated_series(seed=seed)
        z, p, _ = hamed_rao_by_hand(x)
        lib = stats.mk_hamed_rao(x)
        assert abs(lib["z"] - z) < 1e-9 and abs(lib["p"] - p) < 1e-9, seed
