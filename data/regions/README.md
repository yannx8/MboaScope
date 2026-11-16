# Region files

| File | What | Source | Licence |
| --- | --- | --- | --- |
| `cameroon_study_regions.json` | The ten study areas (IMERG cell centres) | MboaScope | Project licence |
| `cameroon_admin1.geojson` | Outlines of Cameroon's ten administrative regions (ADM1), simplified, for the map | geoBoundaries gbOpen CMR ADM1 (source: Wikimedia), build of Dec 12, 2023. https://www.geoboundaries.org | CC BY 3.0. Credit: "geoBoundaries (Runfola et al. 2020)" |

The outlines are for display only. No statistic uses them.

## How the study boxes were checked (task A3)

```
python scripts/check_regions.py ne_10m_populated_places_simple.geojson ne_10m_land.geojson
```

Run from `backend/`. The two Natural Earth files (public domain, https://www.naturalearthdata.com)
are not committed. The script checks that each centre cell contains the city point, that the
3 x 3 box is at least 50% land, and which admin region the city falls in.
