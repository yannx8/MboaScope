"""Spike: open ONE IMERG monthly granule and print its structure. Owner: Developer A (task A1).

CLI: python -m app.cli inspect-granule [--month 2024-12]

Confirms before the full fetch: the HDF5 group and variable names, dimension
order (time, lon, lat), the units attribute, the fill value, and that the
requested month is published. Prints the 3 x 3 cells around Douala.
"""
from __future__ import annotations

from app.core.config import DATASET, END_YEAR


def inspect(month: str = f"{END_YEAR}-12", download: bool = False) -> None:
    import earthaccess

    from app.services.nasa.fetch_imerg import explain_http_error, login, open_grid, open_granules

    login()
    results = earthaccess.search_data(
        short_name=DATASET["short_name"], version=DATASET["version"], temporal=(f"{month}-01", f"{month}-28")
    )
    if not results:
        print(
            f"inspect: no {DATASET['short_name']} v{DATASET['version']} granule for {month}. "
            "V07 Final stops in 2025 (NASA is moving IMERG to V08); try an earlier month."
        )
        return
    print("inspect: granule", results[0].data_links()[0])
    handle = open_granules(results[:1], download)[0]
    try:
        ds = open_grid(handle)
    except Exception as err:
        explain_http_error(err)
        raise
    print(ds)
    da = ds["precipitation"]
    fill = da.encoding.get("_FillValue", da.attrs.get("_FillValue"))
    print("dims:", da.dims, "units:", da.attrs.get("units"), "fill:", fill)
    print(da.sel(lat=slice(3.9, 4.2), lon=slice(9.6, 9.9)).squeeze().values)
