"""Check every study box on a map (task A3). No extra dependency, no network.

Run from backend/:
  python scripts/check_regions.py PLACES LAND [ADMIN1]

PLACES  Natural Earth ne_10m_populated_places_simple.geojson (public domain)
LAND    Natural Earth ne_10m_land.geojson (public domain)
ADMIN1  defaults to data/regions/cameroon_admin1.geojson (geoBoundaries, CC BY 3.0)

For each region it prints:
- whether the centre cell (0.1 degree) contains the city point,
- the share of the 3 x 3 box that is land (sampled on a 10 x 10 grid per cell),
- which admin region the city point falls in.
A box passes when the centre cell contains the city and the 3 x 3 box is at least 50% land.
"""
from __future__ import annotations

import json
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.config import DATA_DIR  # noqa: E402
from app.services.gis.regions import load_regions  # noqa: E402

HALF_CELL = 0.05
SAMPLES_PER_CELL = 10
MIN_LAND_SHARE = 0.5


def _plain(name: str) -> str:
    return unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()


def _in_ring(lon: float, lat: float, ring: list) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def _polygons(geometry: dict) -> list:
    if geometry["type"] == "Polygon":
        return [geometry["coordinates"]]
    if geometry["type"] == "MultiPolygon":
        return geometry["coordinates"]
    return []


def in_geometry(lon: float, lat: float, geometry: dict) -> bool:
    """Point in (multi)polygon, holes respected."""
    for rings in _polygons(geometry):
        if _in_ring(lon, lat, rings[0]) and not any(_in_ring(lon, lat, h) for h in rings[1:]):
            return True
    return False


def _bbox(rings: list) -> tuple[float, float, float, float]:
    xs = [p[0] for p in rings[0]]
    ys = [p[1] for p in rings[0]]
    return min(xs), min(ys), max(xs), max(ys)


def land_polygons_near(land: dict, west: float, south: float, east: float, north: float) -> list:
    """Land polygons whose bounding box touches the area, to keep the check fast."""
    out = []
    for f in land["features"]:
        for rings in _polygons(f["geometry"]):
            x0, y0, x1, y1 = _bbox(rings)
            if x1 >= west and x0 <= east and y1 >= south and y0 <= north:
                out.append({"type": "Polygon", "coordinates": rings})
    return out


def land_share(lat_c: float, lon_c: float, side: int, polygons: list) -> float:
    half = side * HALF_CELL
    n = side * SAMPLES_PER_CELL
    step = 2 * half / n
    hits = 0
    for i in range(n):
        for j in range(n):
            lat = lat_c - half + (i + 0.5) * step
            lon = lon_c - half + (j + 0.5) * step
            hits += any(in_geometry(lon, lat, g) for g in polygons)
    return hits / (n * n)


def main(argv: list[str]) -> int:
    places_path, land_path = Path(argv[0]), Path(argv[1])
    admin_path = Path(argv[2]) if len(argv) > 2 else DATA_DIR / "regions" / "cameroon_admin1.geojson"
    places = json.loads(places_path.read_text(encoding="utf-8"))
    land = json.loads(land_path.read_text(encoding="utf-8"))
    admin = json.loads(admin_path.read_text(encoding="utf-8"))

    cities = {}
    for f in places["features"]:
        p = f["properties"]
        if p.get("adm0name") == "Cameroon":
            cities[_plain(p["name"])] = (float(p["latitude"]), float(p["longitude"]))

    all_ok = True
    for region in load_regions().values():
        lat, lon = cities[_plain(region.name)]
        clat, clon = region.centre_lat, region.centre_lon
        d_lat, d_lon = abs(lat - clat), abs(lon - clon)
        in_cell = d_lat <= HALF_CELL and d_lon <= HALF_CELL
        edge = min(HALF_CELL - d_lat, HALF_CELL - d_lon)
        near = land_polygons_near(land, clon - 0.2, clat - 0.2, clon + 0.2, clat + 0.2)
        share = land_share(clat, clon, 3, near)
        admin_name = next((f["properties"]["shapeName"] for f in admin["features"]
                           if in_geometry(lon, lat, f["geometry"])), "none")
        ok = in_cell and share >= MIN_LAND_SHARE
        all_ok &= ok
        print(f"{region.id:11s} city ({lat:.4f}, {lon:.4f}) centre ({clat:.2f}, {clon:.2f}) "
              f"in centre cell: {'yes' if in_cell else 'NO'} (margin {edge:.4f} deg) | "
              f"3x3 land {share:.0%} | admin region: {admin_name} (expected {region.admin_region}) | "
              f"{'PASS' if ok else 'FAIL'}")
    print("ALL PASS" if all_ok else "SOME FAIL")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
