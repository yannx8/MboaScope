"""Cache for checked Gemini rewrites (task B8). Owner: Developer B.

A page view should never wait for Gemini twice for the same numbers. Only a
rewrite that passed every check is stored, keyed by region, period and a hash
of the analysis. A stored text is checked again on every read, so a stricter
check later drops old texts instead of serving them.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from app.models import database
from app.services.ai import interpreter


def analysis_hash(analysis: dict[str, Any]) -> str:
    """sha256 of the analysis, ignoring when it was generated."""
    body = {k: v for k, v in analysis.items() if k != "generated_at"}
    return hashlib.sha256(json.dumps(body, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()


def _key(analysis: dict[str, Any]) -> tuple[str, int, int, str]:
    h = analysis["headline"]
    start, end = (int(part) for part in str(h["period"]).split("-"))
    return h.get("region_id", "douala"), start, end, analysis_hash(analysis)


def _still_valid(payload: dict[str, Any], analysis: dict[str, Any]) -> bool:
    if payload.get("source") != "gemini" or not payload.get("checks_passed"):
        return False
    try:
        fields = {k: payload[k] for k in interpreter.FIELDS}
        template = interpreter.build_template(analysis)
    except (KeyError, ValueError):
        return False
    return not interpreter.run_checks(fields, analysis) and not interpreter.check_rewrite(fields, template, analysis)


def interpret_cached(
    analysis: dict[str, Any], use_llm: bool = False, call: Any = None, db_path: Path | None = None
) -> tuple[dict[str, Any], list[str]]:
    """Same as interpreter.interpret, but reuses a stored, still-valid Gemini rewrite."""
    if not use_llm:
        return interpreter.interpret(analysis, use_llm=False)
    key = _key(analysis)
    stored = database.get_ai_explanation(*key, db_path=db_path)
    if stored is not None:
        if _still_valid(stored, analysis):
            return stored, []
        database.delete_ai_explanation(*key, db_path=db_path)
    payload, notes = interpreter.interpret(analysis, use_llm=True, call=call)
    if payload.get("source") == "gemini" and payload.get("checks_passed") and not notes:
        database.save_ai_explanation(*key, payload, db_path=db_path)
    return payload, notes
