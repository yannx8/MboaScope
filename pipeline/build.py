"""Run aggregate, analyse, explain; write provenance.json; validate all JSON. CLI: python -m pipeline.build [--llm]. Owner: Lead (issue #3).

Fails (exit code 1) when a stage fails, when a web file breaks its schema, or when
mock and real outputs are mixed.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

from pipeline.common import ROOT, SOURCES_PATH, WEB_DATA, read_sources, write_json
from pipeline.config import DATASET

SCHEMAS = ROOT / "docs" / "contract"
NAMES = ["annual", "analysis", "spatial", "explanation", "provenance"]


def code_commit() -> str:
    """Short hash of the checked-out commit, or "unknown" outside git."""
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True
        )
        return out.stdout.strip() or "unknown"
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def provenance_payload(sources: dict[str, Any], commit: str) -> dict[str, Any]:
    """provenance.json body, from config.DATASET and sources.json."""
    return {
        "dataset": {
            "name": DATASET["name"],
            "short_name": DATASET["short_name"],
            "version": DATASET["version"],
            "doi": DATASET["doi"],
            "variable": DATASET["variable"],
            "source_units": sources.get("source_units", ""),
        },
        "access_method": sources["access_method"],
        "period": sources["period"],
        "granule_count": len(sources.get("granules") or []),
        "code_commit": commit,
        "notes": list(sources.get("notes") or []),
    }


def validate_outputs(web_data: Path, schemas: Path, expected_mock: bool) -> list[str]:
    """Every problem with the five web files: missing, schema errors, wrong is_mock."""
    problems: list[str] = []
    for name in NAMES:
        path = web_data / f"{name}.json"
        if not path.exists():
            problems.append(f"{name}.json: missing")
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        schema = json.loads((schemas / f"{name}.schema.json").read_text(encoding="utf-8"))
        for err in sorted(Draft202012Validator(schema).iter_errors(data), key=lambda e: list(e.path)):
            where = "/".join(str(p) for p in err.path) or "(top level)"
            problems.append(f"{name}.json {where}: {err.message}")
        if data.get("is_mock") is not expected_mock:
            problems.append(
                f"{name}.json: is_mock is {data.get('is_mock')} but sources.json says "
                f"{'mock' if expected_mock else 'real'} data (mixed mock and real outputs)"
            )
    return problems


def run_stages(use_llm: bool) -> str | None:
    """Run the three stages in order. Returns the name of the failed stage, or None."""
    from pipeline import aggregate, analyse, explain

    stages = [
        ("aggregate", lambda: aggregate.main()),
        ("analyse", lambda: analyse.main()),
        ("explain", lambda: explain.main(["--llm"] if use_llm else [])),
    ]
    for name, call in stages:
        print(f"build: running {name}")
        try:
            code = call()
        except Exception as exc:  # report the stage, then stop
            print(f"build: {name} failed: {type(exc).__name__}: {exc}", file=sys.stderr)
            return name
        if isinstance(code, int) and code != 0:
            print(f"build: {name} failed with exit code {code}", file=sys.stderr)
            return name
    return None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m pipeline.build", description=__doc__.splitlines()[0])
    parser.add_argument("--llm", action="store_true", help="pass --llm to explain (Gemini rewrite, local only)")
    args = parser.parse_args(argv)

    sources = read_sources(SOURCES_PATH)
    method = sources.get("access_method")
    expected_mock = method == "mock"
    print(f"build: access_method={method}, is_mock={expected_mock}")

    failed = run_stages(args.llm)
    if failed:
        print(f"build: FAILED at stage {failed}", file=sys.stderr)
        return 1

    write_json(WEB_DATA / "provenance.json", provenance_payload(sources, code_commit()), expected_mock)
    print("build: wrote provenance.json")

    problems = validate_outputs(WEB_DATA, SCHEMAS, expected_mock)
    if problems:
        for problem in problems:
            print(f"build: {problem}", file=sys.stderr)
        print(f"build: FAILED, {len(problems)} problem(s) in the web files", file=sys.stderr)
        return 1

    analysis = json.loads((WEB_DATA / "analysis.json").read_text(encoding="utf-8"))
    explanation = json.loads((WEB_DATA / "explanation.json").read_text(encoding="utf-8"))
    headline = analysis.get("headline", {})
    print(
        f"build: OK. access_method={method}, is_mock={expected_mock}, "
        f"verdict={headline.get('verdict')}, period={headline.get('period')}, "
        f"explanation source={explanation.get('source')}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
