"""Scientific interpretation: template explanation, safety checks, optional Gemini rewrite.

Owner: Developer B (AI tasks). Used by POST /api/ai/interpret.
CLI (evaluation only): python -m app.services.ai.interpreter --eval [--llm]

The AI layer never computes or decides anything. It only words numbers that
the trend analysis already contains, and every field is checked before it is
returned:

- number check: every number in the text must come from the analysis (in its
  display rounding) or from a short list of fixed constants;
- claim check: no banned wording from docs/methodology.md (cause, proof,
  "stable", station, forecast and so on), in any field, negated or not;
- direction check: the wording cannot contradict the verdict.

With use_llm, Gemini may reword three fields (never the summary). The rewrite
is kept only if every check passes; otherwise the template is returned.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any, Iterable

from app.core.config import BOX_KM, get_settings

FIELDS = ("summary", "what_it_means", "what_it_does_not_mean", "limitations")
VERDICTS = ("significant_increase", "significant_decrease", "no_significant_trend")

# Fixed numbers the text may use besides the values in analysis.json:
# 2014 (satellite transition), 0.05 (alpha), 5, 95 (confidence level), 1, 3,
# 11, 33, 55 (box sizes in km), 25, 10 (per decade).
FIXED_NUMBERS = (2014, 0.05, 5, 95, 1, 3, 11, 33, 55, 25, 10)

BOX_SIZE_KM = BOX_KM

PETTITT_2014_SENTENCE = (
    "The change coincides with the 2014 satellite transition (TRMM to GPM), "
    "so it may be an artifact of the data rather than a real shift."
)

# Banned column of docs/methodology.md, section 7. Word starts only, so "improve" and
# "unstable" do not match. No exemption for negated sentences.
BANNED_PATTERNS = (
    r"\bclimate change",
    r"\bglobal warming",
    r"\bdeforest",
    r"\burbani[sz]",
    r"\bhuman",
    r"\bprove",
    r"\bdid not change",
    r"\bdidn't change",
    r"\bno change in rainfall",
    r"\bstable\b",
    r"\bmeasured in\b",
    r"\bstation",
    r"\bgauge",
    r"\bwill increase",
    r"\bwill decrease",
    r"\bforecast",
    r"\bpredict",
)

FORBIDDEN_DIRECTION_WORDS = {
    "significant_increase": ("decreas", "drier", "less rain"),
    "significant_decrease": ("increas", "wetter", "more rain"),
    "no_significant_trend": (),
}

REQUIRED_SUMMARY_PHRASE = {
    "significant_increase": "statistically significant increase",
    "significant_decrease": "statistically significant decrease",
    "no_significant_trend": "no statistically significant trend",
}

# A minus sign only counts when it is not glued to a word or number before it,
# so the period "2001-2025" reads as 2001 and 2025, never as -2025.
# Accepts the ASCII hyphen, the Unicode minus and the en dash as a sign.
NUMBER_RE = re.compile(
    r"(?:(?<![\w.])[-−–])?"
    r"(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?"
    r"|(?:(?<![\w.])[-−–])?\.\d+"
)


class CheckError(ValueError):
    """Raised when an explanation fails one of the checks."""

    def __init__(self, problems: list[str]):
        super().__init__("; ".join(problems))
        self.problems = problems


# ---------------------------------------------------------------- helpers


def _fmt(x: float | int) -> str:
    """Print a number as stored in analysis.json (already display-rounded)."""
    if isinstance(x, float) and x.is_integer() and abs(x) >= 100:
        return str(int(x))
    return str(x)


def _period_years(headline: dict[str, Any]) -> tuple[int, int]:
    start, end = (int(part) for part in str(headline["period"]).split("-"))
    return start, end


def _primary_p(headline: dict[str, Any]) -> float:
    key = "mk_hamed_rao" if headline["mk_test_used"] == "hamed_rao" else "mk_original"
    return headline[key]["p"]


def _test_name(headline: dict[str, Any]) -> str:
    if headline["mk_test_used"] == "hamed_rao":
        return (
            "the modified Mann-Kendall test (Hamed-Rao), used because each "
            "year's total was correlated with the year before"
        )
    return "the Mann-Kendall test"


def _place(headline: dict[str, Any]) -> str:
    return headline.get("region_name", "Douala")


def _box_phrase(headline: dict[str, Any]) -> str:
    km = BOX_SIZE_KM.get(headline["box"])
    place = _place(headline)
    return f"a box of about {km} km around {place}" if km else f"a box around {place}"


def all_text(explanation: dict[str, Any]) -> str:
    """Join the four checked fields into one string."""
    parts = [explanation["summary"], explanation["what_it_means"], explanation["what_it_does_not_mean"]]
    parts.extend(explanation["limitations"])
    return "\n".join(parts)


# ---------------------------------------------------------------- template


def _summary(h: dict[str, Any]) -> str:
    low, high = h["sen_ci95"]
    start, end = _period_years(h)
    verdict = h["verdict"]
    if verdict == "significant_increase":
        finding = "a statistically significant increase in annual rainfall"
    elif verdict == "significant_decrease":
        finding = "a statistically significant decrease in annual rainfall"
    else:
        finding = "no statistically significant trend in annual rainfall"
    return (
        f"For {start}-{end}, the satellite record averaged over {_box_phrase(h)} shows {finding}. "
        f"The estimated change is {_fmt(h['sen_slope_mm_per_year'])} mm per year "
        f"(95% CI {_fmt(low)} to {_fmt(high)})."
    )


def _what_it_means(h: dict[str, Any]) -> str:
    p = _fmt(_primary_p(h))
    alpha = _fmt(h["alpha"])
    n = h["n_years"]
    pct = h["pct_per_decade"]
    mean = _fmt(h["mean_annual_mm"])
    low, high = h["sen_ci95"]
    test = _test_name(h)
    verdict = h["verdict"]

    if verdict == "significant_increase":
        text = (
            f"We used {test} on {n} annual totals. It gave p = {p}, below the {alpha} threshold, "
            f"so the upward tendency is unlikely to be only year-to-year chance. "
            f"The size of the rise is about {_fmt(abs(pct))}% per decade, compared with "
            f"a mean annual total of {mean} mm."
        )
    elif verdict == "significant_decrease":
        text = (
            f"We used {test} on {n} annual totals. It gave p = {p}, below the {alpha} threshold, "
            f"so the downward tendency is unlikely to be only year-to-year chance. "
            f"The size of the fall is about {_fmt(abs(pct))}% per decade, compared with "
            f"a mean annual total of {mean} mm."
        )
    else:
        text = (
            f"We used {test} on {n} annual totals. It gave p = {p}, which is not below the "
            f"{alpha} threshold, so the record cannot separate a steady upward or downward "
            f"tendency from ordinary year-to-year ups and downs. "
            f"The best estimate is {_fmt(pct)}% per decade, compared with a mean annual total "
            f"of {mean} mm."
        )
        if low < 0 < high:
            text += (
                " The 95% interval runs from a negative to a positive value, so the real "
                "change could go either way."
            )

    pettitt = h["pettitt"]
    if pettitt["significant"]:
        year = pettitt["change_year"]
        if 2013 <= year <= 2015:
            text += (
                f" The Pettitt test also found a step change starting in {year}. "
                + PETTITT_2014_SENTENCE
            )
        else:
            text += (
                f" The Pettitt test also found a step change starting in {year}, so part of "
                "the difference may come from one shift rather than a gradual trend."
            )
    return text


def _what_it_does_not_mean(h: dict[str, Any]) -> str:
    start, end = _period_years(h)
    return (
        "This result says nothing about why rainfall behaves this way: the tests describe a "
        "pattern in the numbers, not its reason. "
        f"It says nothing about future years: it covers {start}-{end} only. "
        "A result that is not statistically significant is not evidence that rainfall stayed "
        "the same, because a short record can miss a real but small change. "
        f"The value is a satellite estimate averaged over {_box_phrase(h)}, not a reading at "
        "one point in the city."
    )


def _limitation(code: str, h: dict[str, Any]) -> str:
    if code == "sensor_change_2014":
        return (
            "The satellites behind the data changed in 2014 (TRMM to GPM), and NASA warns "
            "that such a change can create artifacts that look like a trend in multi-year studies."
        )
    if code == "coastal_skill":
        if _place(h) == "Douala":
            return "NASA reports lower IMERG accuracy near coasts, and Douala sits on the Wouri estuary."
        return f"NASA reports lower IMERG accuracy near coasts, and {_place(h)} is close to the coast."
    if code == "short_record":
        return (
            f"With only {h['n_years']} annual values the tests have low statistical power, "
            "so a real but small change can go undetected."
        )
    if code == "area_estimate":
        return (
            f"The numbers are satellite estimates averaged over {_box_phrase(h)}, "
            "not readings at a single point."
        )
    raise ValueError(f"unknown caveat code: {code!r}")


def build_template(analysis: dict[str, Any]) -> dict[str, Any]:
    """The four explanation fields, built from analysis.json only."""
    h = analysis["headline"]
    if h["verdict"] not in VERDICTS:
        raise ValueError(f"unknown verdict: {h['verdict']!r}")
    return {
        "summary": _summary(h),
        "what_it_means": _what_it_means(h),
        "what_it_does_not_mean": _what_it_does_not_mean(h),
        "limitations": [_limitation(code, h) for code in h["caveats"]],
    }


# ---------------------------------------------------------------- checks


def _numbers_in(value: Any) -> Iterable[float]:
    if isinstance(value, bool):
        return
    if isinstance(value, (int, float)):
        yield float(value)
    elif isinstance(value, dict):
        for v in value.values():
            yield from _numbers_in(v)
    elif isinstance(value, list):
        for v in value:
            yield from _numbers_in(v)


def _key(x: float) -> float:
    return round(float(x), 6)


def allowed_numbers(analysis: dict[str, Any]) -> set[float]:
    """Numbers the text may contain."""
    body = {k: v for k, v in analysis.items() if k not in ("contract_version", "generated_at", "is_mock")}
    allowed: set[float] = set()
    for x in _numbers_in(body):
        allowed.add(_key(x))
        allowed.add(_key(abs(x)))
    start, end = _period_years(analysis["headline"])
    allowed.update(_key(y) for y in range(start, end + 1))
    allowed.update(_key(x) for x in FIXED_NUMBERS)
    return allowed


def extract_numbers(text: str) -> list[tuple[str, float]]:
    """Every number written in the text, as (as written, value)."""
    found = []
    for match in NUMBER_RE.finditer(text):
        raw = match.group(0)
        cleaned = raw.replace(",", "").replace("−", "-").replace("–", "-")
        found.append((raw, float(cleaned)))
    return found


def check_numbers(text: str, analysis: dict[str, Any]) -> list[str]:
    allowed = allowed_numbers(analysis)
    return [f"number not in analysis.json: {raw}" for raw, value in extract_numbers(text) if _key(value) not in allowed]


def check_claims(text: str) -> list[str]:
    problems = []
    for pattern in BANNED_PATTERNS:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            problems.append(f"banned wording: {match.group(0)!r}")
    return problems


def check_direction(explanation: dict[str, Any], verdict: str) -> list[str]:
    text = all_text(explanation).lower()
    problems = [
        f"direction word {word!r} contradicts verdict {verdict}"
        for word in FORBIDDEN_DIRECTION_WORDS[verdict]
        if word in text
    ]
    phrase = REQUIRED_SUMMARY_PHRASE[verdict]
    if phrase not in explanation["summary"].lower():
        problems.append(f"summary must contain {phrase!r}")
    return problems


def check_shape(explanation: dict[str, Any], n_limitations: int = 4) -> list[str]:
    """Field types, and one limitation sentence per caveat code."""
    problems = []
    for field in FIELDS[:3]:
        if not isinstance(explanation.get(field), str) or not explanation[field].strip():
            problems.append(f"{field} must be a non-empty string")
    lims = explanation.get("limitations")
    if (
        not isinstance(lims, list)
        or len(lims) != n_limitations
        or not all(isinstance(s, str) and s.strip() for s in lims)
    ):
        problems.append(f"limitations must be a list of {n_limitations} non-empty strings")
    return problems


def run_checks(explanation: dict[str, Any], analysis: dict[str, Any]) -> list[str]:
    """All problems found; an empty list means every check passed."""
    problems = check_shape(explanation, len(analysis["headline"]["caveats"]))
    if problems:
        return problems
    text = all_text(explanation)
    problems += check_numbers(text, analysis)
    problems += check_claims(text)
    problems += check_direction(explanation, analysis["headline"]["verdict"])
    return problems


def assert_checks(explanation: dict[str, Any], analysis: dict[str, Any]) -> None:
    """Raise CheckError if any check fails (used in tests)."""
    problems = run_checks(explanation, analysis)
    if problems:
        raise CheckError(problems)


# ---------------------------------------------------------------- Gemini (#21)

PROMPT_PATH = Path(__file__).resolve().parent / "prompts" / "rewrite.md"
FIXTURES = Path(__file__).resolve().parents[4] / "tests" / "fixtures"
DEFAULT_MODEL = "gemini-3.6-flash"
TEMPERATURE = 0.2
MAX_WORDS = 120
LLM_FIELDS = ("what_it_means", "what_it_does_not_mean", "limitations")
EVAL_CASES = (
    "increase",
    "increase_pettitt2014",
    "decrease",
    "decrease_pettitt2014",
    "no_trend",
    "no_trend_pettitt2014",
    "increase_inland",
    "decrease_inland",
    "no_trend_inland",
)

# Words a rewrite must keep so that no caveat is dropped or softened.
CAVEAT_KEYWORDS = {
    "sensor_change_2014": ("2014", "TRMM", "GPM"),
    "coastal_skill": ("coast",),
    "short_record": ("power",),
    "area_estimate": ("average",),
}


def build_prompt(analysis: dict[str, Any], template: dict[str, Any]) -> str:
    """The rewrite prompt with the analysis JSON and the template text filled in."""
    body = {k: v for k, v in analysis.items() if k not in ("generated_at",)}
    return (
        PROMPT_PATH.read_text(encoding="utf-8")
        .replace("{{ANALYSIS_JSON}}", json.dumps(body, indent=2))
        .replace("{{TEMPLATE_JSON}}", json.dumps(template, indent=2, ensure_ascii=False))
    )


def parse_llm_json(text: str) -> dict[str, Any]:
    """Read the model's JSON answer, tolerating a markdown code fence."""
    cleaned = text.strip()
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", cleaned, flags=re.DOTALL)
    if fence:
        cleaned = fence.group(1)
    data = json.loads(cleaned)
    if not isinstance(data, dict):
        raise ValueError("model answer is not a JSON object")
    return data


def check_rewrite(fields: dict[str, Any], template: dict[str, Any], analysis: dict[str, Any]) -> list[str]:
    """Extra checks for a model rewrite, on top of run_checks."""
    problems = []
    if fields.get("summary") != template["summary"]:
        problems.append("summary must stay the template text")
    for field in LLM_FIELDS:
        value = fields.get(field)
        text = " ".join(value) if isinstance(value, list) else str(value or "")
        words = len(text.split())
        if words > MAX_WORDS:
            problems.append(f"{field} has {words} words (max {MAX_WORDS})")
    lims = " ".join(fields.get("limitations") or []).lower()
    for code in analysis["headline"]["caveats"]:
        for word in CAVEAT_KEYWORDS.get(code, ()):
            if word.lower() not in lims:
                problems.append(f"limitations lost caveat {code} (missing {word!r})")
    if PETTITT_2014_SENTENCE in template["what_it_means"]:
        if "artifact" not in str(fields.get("what_it_means", "")).lower():
            problems.append("what_it_means lost the 2014 artifact warning")
    if "\u2014" in all_text(fields):
        problems.append("em dash in text")
    return problems


def pick_flash_model(names: Iterable[str]) -> str | None:
    """Pick the newest general Gemini Flash model from a list of model names."""
    skip = ("lite", "image", "tts", "live", "audio", "embedding", "thinking", "8b", "exp")

    def version(name: str) -> tuple[float, int]:
        match = re.search(r"gemini-(\d+(?:\.\d+)?)-flash", name)
        stable = 0 if "preview" in name else 1
        return (float(match.group(1)) if match else 0.0, stable)

    candidates = [
        n.removeprefix("models/")
        for n in names
        if "flash" in n and "gemini" in n and not any(s in n for s in skip)
    ]
    if not candidates:
        return None
    return max(candidates, key=version)


RETRY_CODES = (429, 500, 503, 504)
RETRY_WAITS = (5, 15, 30, 60)  # seconds before each new attempt
EVAL_PAUSE = 4  # seconds between eval cases, to stay under free-tier limits


def with_retries(fn: Any, waits: Iterable[float] = RETRY_WAITS, sleep: Any = None) -> Any:
    """Call fn(); on a busy or rate-limit error (429, 5xx), wait and try again."""
    import time

    sleep = sleep or time.sleep
    waits = list(waits)
    for attempt in range(len(waits) + 1):
        try:
            return fn()
        except Exception as err:
            code = getattr(err, "code", None)
            if code not in RETRY_CODES or attempt == len(waits):
                raise
            print(f"explain: gemini busy ({code}), retrying in {waits[attempt]} s", file=sys.stderr)
            sleep(waits[attempt])


def call_gemini(prompt: str, model: str, api_key: str) -> tuple[str, str]:
    """Send the prompt to Gemini. Returns (answer text, model name used)."""
    from google import genai  # imported here so CI and the template never need it
    from google.genai import errors, types

    client = genai.Client(api_key=api_key)
    config = types.GenerateContentConfig(temperature=TEMPERATURE, response_mime_type="application/json")

    def generate(name: str) -> tuple[str, str]:
        def once() -> tuple[str, str]:
            response = client.models.generate_content(model=name, contents=prompt, config=config)
            return response.text or "", response.model_version or name

        return with_retries(once)

    try:
        return generate(model)
    except errors.ClientError as err:
        if getattr(err, "code", None) not in (400, 404):
            raise
        names = [
            m.name
            for m in client.models.list()
            if m.name and "generateContent" in (m.supported_actions or ["generateContent"])
        ]
        fallback = pick_flash_model(names)
        if not fallback or fallback == model:
            raise
        print(f"explain: model {model!r} rejected, using {fallback!r} instead", file=sys.stderr)
        return generate(fallback)


def rewrite_with_llm(
    analysis: dict[str, Any],
    template: dict[str, Any],
    call: Any,
) -> tuple[dict[str, Any], list[str]]:
    """Ask the model for a rewrite and check it.

    `call(prompt) -> (text, model)` does the API call (a fake in tests).
    Returns the payload to save and the reasons the rewrite was rejected
    (empty when the Gemini text is kept). Any failure falls back to the template.
    """
    fallback = {"source": "template", "model": None, "checks_passed": True, **template}
    try:
        text, model = call(build_prompt(analysis, template))
        answer = parse_llm_json(text)
    except Exception as err:  # any API or parsing error means: ship the template
        return fallback, [f"gemini error: {type(err).__name__}: {err}"]
    fields = {"summary": template["summary"], **{k: answer.get(k) for k in LLM_FIELDS}}
    problems = run_checks(fields, analysis)
    if not problems:
        problems = check_rewrite(fields, template, analysis)
    if problems:
        return fallback, problems
    return {"source": "gemini", "model": model, "checks_passed": True, **fields}, []


def _gemini_settings() -> tuple[str, str]:
    settings = get_settings()
    return settings.gemini_api_key, settings.gemini_model or DEFAULT_MODEL


# ---------------------------------------------------------------- CLI


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def explain(analysis: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    """Template explanation plus the list of check problems (empty when clean)."""
    fields = build_template(analysis)
    problems = run_checks(fields, analysis)
    payload = {"source": "template", "model": None, "checks_passed": not problems, **fields}
    return payload, problems


def _make_caller(api_key: str, model: str):
    def call(prompt: str) -> tuple[str, str]:
        return call_gemini(prompt, model, api_key)

    return call


def run_eval(use_llm: bool) -> int:
    """Print the fixture evaluation as markdown, ready to paste in docs/ai-eval.md (task B7)."""
    api_key, model = _gemini_settings()
    if use_llm and not api_key:
        print("explain: GEMINI_API_KEY is not set in .env", file=sys.stderr)
        return 1
    call = _make_caller(api_key, model) if use_llm else None
    rows, details = [], []
    import time

    for index, case in enumerate(EVAL_CASES):
        if use_llm and index:
            time.sleep(EVAL_PAUSE)
        analysis = read_json(FIXTURES / f"analysis_{case}.json")
        payload, problems = explain(analysis)
        why = "; ".join(problems)
        if use_llm and not problems:
            payload, problems = rewrite_with_llm(analysis, build_template(analysis), call)
            why = "; ".join(problems)
        passed = "yes" if payload["source"] == ("gemini" if use_llm else "template") and not problems else "no"
        rows.append(f"| {case} | {payload['source']} | {payload['model'] or '-'} | {passed} | {why or '-'} | |")
        details.append(
            f"### {case} ({payload['source']})\n\n"
            f"**what_it_means:** {payload['what_it_means']}\n\n"
            f"**what_it_does_not_mean:** {payload['what_it_does_not_mean']}\n\n"
            "**limitations:**\n" + "\n".join(f"- {s}" for s in payload["limitations"]) + "\n"
        )
    print("| case | source | model | checks passed | rejection reason | clarity 1-5 |")
    print("| --- | --- | --- | --- | --- | --- |")
    print("\n".join(rows))
    print()
    print("\n".join(details))
    return 0


def interpret(analysis: dict[str, Any], use_llm: bool = False, call: Any = None) -> tuple[dict[str, Any], list[str]]:
    """Explanation for the API: the checked template, or a checked Gemini rewrite.

    Returns (payload, notes). `notes` lists why Gemini was not used (empty when
    the template was requested or the rewrite was kept). `call` replaces the
    real Gemini call in tests.
    """
    payload, problems = explain(analysis)
    if problems:
        # The template should never fail. If it does, say so; the frontend hides the text.
        return payload, [f"template check failed: {p}" for p in problems]
    if not use_llm:
        return payload, []
    if call is None:
        api_key, model = _gemini_settings()
        if not api_key:
            return payload, ["GEMINI_API_KEY is not set"]
        call = _make_caller(api_key, model)
    template = {k: payload[k] for k in FIELDS}
    return rewrite_with_llm(analysis, template, call)


def suggest_investigations(analysis: dict[str, Any]) -> list[dict[str, Any]]:
    """Follow-up investigations the user can run with one click. Deterministic, no model.

    Each suggestion carries the request parameters the frontend sends back.
    """
    h = analysis["headline"]
    start, end = _period_years(h)
    region = h.get("region_id", "douala")
    out: list[dict[str, Any]] = []
    if "sensor_change_2014" in h["caveats"]:
        if end - 2014 + 1 >= 10:
            out.append({
                "title": "Repeat the test on the GPM era only",
                "reason": "The satellites changed in 2014. Testing only the later years shows whether the result depends on that step.",
                "region_id": region, "start_year": 2014, "end_year": end,
            })
        if 2013 - start + 1 >= 10:
            out.append({
                "title": "Repeat the test on the TRMM era only",
                "reason": "Testing only the years before the 2014 satellite change gives a second view that avoids the transition.",
                "region_id": region, "start_year": start, "end_year": 2013,
            })
    out.append({
        "title": "Compare with another region",
        "reason": "The same test in a region with a different climate shows whether the pattern is local.",
        "region_id": None, "start_year": start, "end_year": end,
    })
    return out


def main(argv: list[str] | None = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(prog="python -m app.services.ai.interpreter", description="Evaluate the explanation on the fixture cases.")
    parser.add_argument("--llm", action="store_true", help="ask Gemini for a rewrite (local only, never in CI)")
    parser.add_argument("--eval", action="store_true", help="run the fixture cases and print a markdown report")
    args = parser.parse_args(argv)
    if not args.eval:
        parser.print_help()
        return 0
    return run_eval(args.llm)


if __name__ == "__main__":
    sys.exit(main())
