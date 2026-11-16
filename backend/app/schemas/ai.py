"""AI interpretation and questions. Owner: Developer B."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import Envelope, InvestigationRequest


class InterpretRequest(InvestigationRequest):
    use_llm: bool = Field(False, description="Ask Gemini to reword the checked template. Falls back to the template.")


class Explanation(BaseModel):
    source: Literal["template", "gemini"]
    model: str | None
    checks_passed: bool
    summary: str
    what_it_means: str
    what_it_does_not_mean: str
    limitations: list[str]


class Suggestion(BaseModel):
    title: str
    reason: str
    region_id: str | None  # None means "let the user pick a region"
    start_year: int
    end_year: int


class InterpretResponse(Envelope):
    region_id: str
    explanation: Explanation
    notes: list[str]  # why Gemini was not used, if it was requested
    suggestions: list[Suggestion]


class AskRequest(InvestigationRequest):
    question: str = Field(min_length=2, max_length=300, examples=["Is it getting wetter?"])
    use_llm: bool = Field(False, description="Let Gemini answer. Falls back to fixed rules, then to a refusal.")


class Answer(BaseModel):
    source: Literal["rules", "gemini", "refusal"]
    model: str | None
    answered: bool
    text: str


class AskResponse(Envelope):
    region_id: str
    question: str
    answer: Answer
    notes: list[str]  # why Gemini or a rule was not used
