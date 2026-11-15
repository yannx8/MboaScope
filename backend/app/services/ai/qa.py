"""Free-text questions about one analysis (task B9). Owner: Developer B.

The answer may only come from the analysis JSON. Order of work:

1. a question about another region is redirected, and an out-of-scope question
   (temperature, floods, weather and so on) is refused, without calling any model;
2. with use_llm, Gemini answers; the answer is kept only if it passes the same
   number and claim checks as the explanation, a direction check and a length check;
3. otherwise a fixed rule answers the common questions from the numbers;
4. if no rule fits, the user gets REFUSAL.
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Any, Callable, Iterable

from app.services.ai import interpreter as ex

REFUSAL = "I can only answer from the computed results."
MAX_WORDS = 100
MAX_QUESTION_CHARS = 300
PROMPT_PATH = Path(__file__).resolve().parent / "prompts" / "ask.md"

# Topics the rainfall trend analysis says nothing about. Refused before any model call.
OUT_OF_SCOPE = (
    r"\btemperature", r"\bheat", r"\bflood", r"\bdrought", r"\bweather", r"\btoday\b",
    r"\btomorrow\b", r"\bhumidity", r"\bwind\b", r"\bstorm",
)

# A no-trend answer may not claim any direction.
NO_TREND_DIRECTION_WORDS = ("wetter", "drier", "more rain", "less rain")

# (intent, patterns) in priority order: the first match wins.
INTENTS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("future", (r"\bwill\b", r"\bnext year", r"\bfuture", r"\bforecast", r"\bpredict", r"\b20[3-9]\d\b")),
    ("cause", (r"\bwhy\b", r"\bcause", r"\breason", r"\bprove", r"\bclimate", r"\bglobal warming", r"\bhuman", r"\bdeforest")),
    ("location", (r"\bstation", r"\bgauge", r"\bmeasured", r"\bwhere\b", r"\bin the city", r"\bbox\b")),
    ("sensor", (r"\b2014\b", r"\bsatellite", r"\btrmm\b", r"\bgpm\b", r"\bsensor", r"\bpettitt", r"\bstep change")),
    ("years", (r"\bhow many years", r"\bnumber of years", r"\bhow long", r"\bperiod\b", r"\bwhich years", r"\byears of data")),
    ("mean", (r"\baverage", r"\bmean\b", r"\btypical", r"\bnormal\b", r"\bannual (?:total|rainfall)\b")),
    ("significance", (r"\bsignifican", r"\bp-?value", r"\bconfiden", r"\bsure\b", r"\breliab", r"\btest\b")),
    ("slope", (r"\bslope", r"\bper year", r"\bhow much", r"\bhow fast", r"\brate\b", r"\bper decade", r"\bchang")),
    ("direction", (
        r"\bwetter", r"\bdrier", r"\bdryer", r"\bdrying", r"\bincreas", r"\bdecreas", r"\btrend",
        r"\bmore rain", r"\bless rain", r"\brain(?:ing|fall)? more", r"\bgetting\b",
    )),
)


def _fold(text: str) -> str:
    """Lower case without accents, so "Yaounde" matches "Yaoundé"."""
    return "".join(c for c in unicodedata.normalize("NFD", text.lower()) if unicodedata.category(c) != "Mn")


def classify(question: str) -> str | None:
    q = _fold(question)
    for intent, patterns in INTENTS:
        if any(re.search(p, q) for p in patterns):
            return intent
    return None


def is_out_of_scope(question: str) -> bool:
    q = _fold(question)
    return any(re.search(p, q) for p in OUT_OF_SCOPE)


def other_region_named(question: str, analysis: dict[str, Any], other_regions: Iterable[tuple[str, str]]) -> str | None:
    """The display name of another region the question mentions, if any."""
    q = _fold(question)
    current = analysis["headline"].get("region_id")
    for region_id, name in other_regions:
        if region_id == current:
            continue
        if re.search(rf"\b{re.escape(_fold(name))}\b", q) or re.search(rf"\b{re.escape(_fold(region_id))}\b", q):
            return name
    return None


# ---------------------------------------------------------------- rule answers


def _first_sentence(text: str) -> str:
    return text.split(". ")[0].rstrip(".") + "."


def rule_answer(intent: str, analysis: dict[str, Any]) -> str:
    """A fixed answer built from the analysis numbers only."""
    h = analysis["headline"]
    t = ex.build_template(analysis)
    f = ex._fmt
    start, end = ex._period_years(h)
    place = ex._place(h)
    box = ex._box_phrase(h)
    low, high = h["sen_ci95"]
    verdict = h["verdict"]

    if intent == "direction":
        return t["summary"]
    if intent == "slope":
        text = (
            f"The estimated change for {start}-{end} is {f(h['sen_slope_mm_per_year'])} mm per year "
            f"(95% CI {f(low)} to {f(high)}), about {f(h['pct_per_decade'])}% per decade."
        )
        if verdict == "no_significant_trend":
            text += " The result is not statistically significant, so this estimate is uncertain."
        return text
    if intent == "significance":
        test = "the modified Mann-Kendall test (Hamed-Rao)" if h["mk_test_used"] == "hamed_rao" else "the Mann-Kendall test"
        p = f(ex._primary_p(h))
        alpha = f(h["alpha"])
        if verdict == "no_significant_trend":
            return (
                f"No. We used {test}, which gave p = {p}, not below the {alpha} threshold. "
                "That is not evidence that rainfall stayed the same: a short record can miss a small change."
            )
        word = "increase" if verdict == "significant_increase" else "decrease"
        return f"Yes. We used {test}, which gave p = {p}, below the {alpha} threshold, so the {word} is statistically significant."
    if intent == "mean":
        return f"The mean annual total for {start}-{end} is {f(h['mean_annual_mm'])} mm, a satellite estimate averaged over {box}."
    if intent == "years":
        return f"The analysis used {h['n_years']} annual totals, for {start}-{end}."
    if intent == "location":
        return f"No. The values are satellite estimates (NASA IMERG) averaged over {box}, not a reading at one point in {place}."
    if intent == "cause":
        return "The analysis cannot say why. The tests describe a pattern in the numbers, not its reason. " + _first_sentence(t["summary"])
    if intent == "future":
        return f"The analysis covers {start}-{end} only, so it says nothing about future years."
    if intent == "sensor":
        pettitt = h["pettitt"]
        if pettitt["significant"]:
            year = pettitt["change_year"]
            text = f"The Pettitt test found a step change starting in {year}."
            if 2013 <= year <= 2015:
                text += " " + ex.PETTITT_2014_SENTENCE
            return text
        text = "The Pettitt test found no statistically significant step change in this record."
        if "sensor_change_2014" in h["caveats"]:
            text += " " + ex._limitation("sensor_change_2014", h)
        return text
    raise ValueError(f"unknown intent: {intent!r}")


# ---------------------------------------------------------------- checks


def check_answer(text: str, analysis: dict[str, Any]) -> list[str]:
    """Problems with an answer; an empty list means it may be shown."""
    if not isinstance(text, str) or not text.strip():
        return ["answer is empty"]
    problems = []
    words = len(text.split())
    if words > MAX_WORDS:
        problems.append(f"answer has {words} words (max {MAX_WORDS})")
    if "—" in text:
        problems.append("em dash in text")
    problems += ex.check_numbers(text, analysis)
    problems += ex.check_claims(text)
    verdict = analysis["headline"]["verdict"]
    forbidden = ex.FORBIDDEN_DIRECTION_WORDS[verdict] or NO_TREND_DIRECTION_WORDS
    lowered = text.lower()
    problems += [f"direction word {w!r} contradicts verdict {verdict}" for w in forbidden if w in lowered]
    return problems


# ---------------------------------------------------------------- model


def build_prompt(question: str, analysis: dict[str, Any]) -> str:
    """The question prompt. Braces are removed from the question so it cannot fill a placeholder."""
    body = {k: v for k, v in analysis.items() if k != "generated_at"}
    safe_question = re.sub(r"[{}]", "", question)[:MAX_QUESTION_CHARS]
    head, _, tail = PROMPT_PATH.read_text(encoding="utf-8").partition("{{QUESTION}}")
    return head.replace("{{ANALYSIS_JSON}}", json.dumps(body, indent=2)) + safe_question + tail


def _ask_model(
    question: str, analysis: dict[str, Any], call: Callable[[str], tuple[str, str]]
) -> tuple[dict[str, Any] | None, list[str]]:
    try:
        text, model = call(build_prompt(question, analysis))
        data = ex.parse_llm_json(text)
    except Exception as err:  # any API or parsing error: fall back to the rules
        return None, [f"gemini error: {type(err).__name__}: {err}"]
    answer = data.get("answer")
    if answer is None:
        return None, ["gemini declined to answer"]
    if not isinstance(answer, str):
        return None, ["gemini answer rejected: answer is not text"]
    problems = check_answer(answer, analysis)
    if problems:
        return None, ["gemini answer rejected: " + "; ".join(problems)]
    return {"source": "gemini", "model": model, "answered": True, "text": answer.strip()}, []


def _refusal() -> dict[str, Any]:
    return {"source": "refusal", "model": None, "answered": False, "text": REFUSAL}


def ask(
    question: str,
    analysis: dict[str, Any],
    use_llm: bool = False,
    call: Callable[[str], tuple[str, str]] | None = None,
    other_regions: Iterable[tuple[str, str]] = (),
) -> tuple[dict[str, Any], list[str]]:
    """Answer one question. Returns (answer, notes); notes say why Gemini or a rule was not used."""
    h = analysis["headline"]
    other = other_region_named(question, analysis, other_regions)
    if other:
        text = (
            f"This answer can only use the analysis for {ex._place(h)}. "
            f"To see {other}, choose it in the region menu and ask again."
        )
        return {"source": "rules", "model": None, "answered": True, "text": text}, ["the question names another region"]
    if is_out_of_scope(question):
        return _refusal(), ["the question is outside the rainfall trend analysis"]

    notes: list[str] = []
    if use_llm:
        if call is None:
            api_key, model = ex._gemini_settings()
            if api_key:
                call = ex._make_caller(api_key, model)
            else:
                notes.append("GEMINI_API_KEY is not set")
        if call is not None:
            answer, model_notes = _ask_model(question, analysis, call)
            if answer is not None:
                return answer, []
            notes += model_notes

    intent = classify(question)
    if intent is None:
        return _refusal(), notes + ["no rule matches the question"]
    text = rule_answer(intent, analysis)
    problems = check_answer(text, analysis)
    if problems:  # a rule answer should never fail; refuse rather than show it
        return _refusal(), notes + [f"rule answer failed: {p}" for p in problems]
    return {"source": "rules", "model": None, "answered": True, "text": text}, notes
