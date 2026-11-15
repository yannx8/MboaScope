"""Data commands. Run from backend/: python -m app.cli <command>. Owner: Developer A.

  seed-mock        [--region ID ...]                 synthetic data so nobody waits
  inspect-granule  [--month YYYY-MM] [--download]    spike: one real IMERG granule
  fetch-imerg      [--region ID ...] [--limit N] [--download]   real per-cell data (plan A)
  import-giovanni  FILE --region ID [--activate]     Giovanni box CSV (plan B)
  status                                             what is in the database
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from app.models import database as db


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli", description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("seed-mock")
    p.add_argument("--region", action="append")

    p = sub.add_parser("inspect-granule")
    p.add_argument("--month")
    p.add_argument("--download", action="store_true", help="save the file in data/raw/imerg/ instead of streaming")

    p = sub.add_parser("fetch-imerg")
    p.add_argument("--region", action="append")
    p.add_argument("--start")
    p.add_argument("--end")
    p.add_argument("--limit", type=int)
    p.add_argument("--download", action="store_true", help="save whole files in data/raw/imerg/ (resumable)")

    p = sub.add_parser("import-giovanni")
    p.add_argument("file", type=Path)
    p.add_argument("--region", required=True)
    p.add_argument("--units")
    p.add_argument("--activate", action="store_true")

    sub.add_parser("status")
    args = parser.parse_args(argv)

    # Load .env from the repository root before any command that needs
    # EARTHDATA_* or GEMINI_* variables (earthaccess reads os.environ directly).
    from app.core.config import get_settings

    get_settings()

    if args.cmd == "seed-mock":
        from app.services.nasa import mock

        for rid, n in mock.seed_all(args.region).items():
            print(f"seed-mock: {rid}: {n} rows")
    elif args.cmd == "inspect-granule":
        from app.services.nasa import inspect_granule

        inspect_granule.inspect(*([args.month] if args.month else []), download=args.download)
    elif args.cmd == "fetch-imerg":
        from app.services.nasa import fetch_imerg

        kwargs = {k: v for k, v in {"start": args.start, "end": args.end}.items() if v}
        for rid, n in fetch_imerg.fetch(args.region, limit=args.limit, download=args.download, **kwargs).items():
            print(f"fetch-imerg: {rid}: {n} rows stored")
    elif args.cmd == "import-giovanni":
        from app.services.gis.regions import get_region
        from app.services.nasa import giovanni

        giovanni.run(args.file, get_region(args.region).id, args.units, args.activate)
    elif args.cmd == "status":
        sources = db.all_sources()
        if not sources:
            print("status: database is empty. Run: python -m app.cli seed-mock")
        for rid, s in sorted(sources.items()):
            print(f"{rid:12s} {s['access_method']:13s} {s['period_start']}..{s['period_end']}  updated {s['updated_at']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
