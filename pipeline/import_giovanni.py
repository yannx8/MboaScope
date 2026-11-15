"""Parse a Giovanni area-averaged CSV. CLI: python -m pipeline.import_giovanni FILE [--units U] [--activate]. Owner: Data (issue #10).

Always writes data/interim/box_monthly_rate.csv (month, box, rate, units; box is box_3x3),
values exactly as Giovanni stores them. Writes data/interim/sources.json only with
--activate, because access_method in that file switches the whole run to plan B.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path

from pipeline.common import INTERIM, ROOT

BOX = "box_3x3"
BOX_COLUMNS = ["month", "box", "rate", "units"]
UNITS_PATTERN = re.compile(r"\b(mm\s*/\s*(?:hr|h|day|d|month)|mm\s+(?:hr|h|d)-1)\b", re.IGNORECASE)
FILL_PATTERN = re.compile(r"^fill value", re.IGNORECASE)


def parse(text: str, units: str | None = None) -> tuple[list[dict], str]:
    """Return (rows, units) from the text of a Giovanni area-averaged time series CSV.

    Skips metadata lines until the header row whose first cell is `time`. Units come
    from the metadata lines, else from `units`. Fill values are dropped (the month is
    then missing, never filled).
    """
    found_units: str | None = None
    fill_values: set[float] = set()
    rows: list[dict] = []
    in_data = False

    for record in csv.reader(text.splitlines()):
        cells = [c.strip() for c in record]
        if not cells or not any(cells):
            continue
        if not in_data:
            if cells[0].lower() == "time":
                in_data = True
                continue
            line = ",".join(cells)
            if found_units is None:
                match = UNITS_PATTERN.search(line)
                if match:
                    found_units = re.sub(r"\s+", "", match.group(1)).lower()
            if FILL_PATTERN.match(cells[0]) and len(cells) > 1:
                try:
                    fill_values.add(float(cells[1]))
                except ValueError:
                    pass
            continue
        if len(cells) < 2 or not re.match(r"^\d{4}-\d{2}", cells[0]):
            continue
        try:
            value = float(cells[1])
        except ValueError:
            continue
        if value in fill_values or value < -9000:
            continue
        rows.append({"month": cells[0][:7], "rate": value})

    if not in_data:
        raise ValueError("no header row starting with 'time' found: is this a Giovanni time series CSV?")
    if not rows:
        raise ValueError("the Giovanni file has a header but no data rows")
    final_units = found_units or (units.strip() if units else None)
    if not final_units:
        raise ValueError("units not found in the file's metadata: pass --units (for example --units mm/hr)")

    by_month = {r["month"]: r["rate"] for r in rows}
    out = [{"month": m, "box": BOX, "rate": by_month[m], "units": final_units} for m in sorted(by_month)]
    return out, final_units


def write_box_csv(rows: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=BOX_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)


def sources_payload(rows: list[dict], units: str, source_file: Path) -> dict:
    try:
        shown = source_file.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        shown = source_file.name
    return {
        "access_method": "giovanni_csv",
        "source_units": units,
        "period": {"start": rows[0]["month"], "end": rows[-1]["month"]},
        "granules": [],
        "notes": [
            "area average computed by Giovanni",
            f"source file: {shown}",
            "box_3x3 only: no per-cell values, so the trend map is not available",
        ],
    }


def run(file: Path, units: str | None = None, activate: bool = False, interim: Path = INTERIM) -> list[dict]:
    rows, final_units = parse(Path(file).read_text(encoding="utf-8-sig"), units)
    write_box_csv(rows, interim / "box_monthly_rate.csv")
    print(f"import_giovanni: wrote box_monthly_rate.csv ({len(rows)} months, {rows[0]['month']} to {rows[-1]['month']}, {final_units})")
    if activate:
        (interim / "sources.json").write_text(
            json.dumps(sources_payload(rows, final_units, Path(file)), indent=2) + "\n", encoding="utf-8"
        )
        print("import_giovanni: sources.json now says access_method giovanni_csv (plan B active)")
    else:
        print("import_giovanni: sources.json unchanged (cross-check only; add --activate for plan B)")
    return rows


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="python -m pipeline.import_giovanni", description=__doc__.splitlines()[0])
    parser.add_argument("file", type=Path, help="the Giovanni CSV, for example data/external/giovanni_box_3x3.csv")
    parser.add_argument("--units", help="units to use when the file's metadata does not give them")
    parser.add_argument("--activate", action="store_true", help="also write sources.json: switches the run to plan B")
    args = parser.parse_args(argv)
    run(args.file, args.units, args.activate)


if __name__ == "__main__":
    main()
