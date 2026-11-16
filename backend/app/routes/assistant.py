"""POST /api/ai/interpret and POST /api/ai/ask. Owner: Developer B."""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool

from app.schemas.ai import Answer, AskRequest, AskResponse, Explanation, InterpretRequest, InterpretResponse, Suggestion
from app.services import investigation
from app.services.ai import cache, interpreter, qa
from app.services.gis.regions import load_regions

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/interpret", response_model=InterpretResponse)
async def interpret(req: InterpretRequest) -> InterpretResponse:
    inv = investigation.run(req.region_id, req.start_year, req.end_year)
    analysis = investigation.require_analysis(inv)
    # Gemini calls block for seconds: keep them off the event loop. Accepted rewrites are cached.
    payload, notes = await run_in_threadpool(cache.interpret_cached, analysis, req.use_llm)
    return InterpretResponse(
        is_mock=inv.is_mock,
        region_id=inv.region.id,
        explanation=Explanation(**payload),
        notes=notes,
        suggestions=[Suggestion(**s) for s in interpreter.suggest_investigations(analysis)],
    )


@router.post("/ask", response_model=AskResponse)
async def ask(req: AskRequest) -> AskResponse:
    inv = investigation.run(req.region_id, req.start_year, req.end_year)
    analysis = investigation.require_analysis(inv)
    others = [(r.id, r.name) for r in load_regions().values() if r.id != inv.region.id]
    answer, notes = await run_in_threadpool(
        lambda: qa.ask(req.question, analysis, use_llm=req.use_llm, other_regions=others)
    )
    return AskResponse(
        is_mock=inv.is_mock,
        region_id=inv.region.id,
        question=req.question,
        answer=Answer(**answer),
        notes=notes,
    )
