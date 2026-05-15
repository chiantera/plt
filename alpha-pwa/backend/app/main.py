from __future__ import annotations

import uuid
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .ai_service import analyze_case, stream_chat
from .demo_data import build_demo_case, get_all_cases, get_case_summaries
from .models import AnalyzeRequest, CaseAnalysis, CaseSummary, ChatRequest

app = FastAPI(title="Pocket Legal Triage Alpha", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "plt-alpha-backend", "version": "0.2.0"}


# ── Cases list ───────────────────────────────────────────────────────────────

@app.get("/api/cases", response_model=list[CaseSummary])
def list_cases() -> list[CaseSummary]:
    return get_case_summaries()


@app.get("/api/cases/{case_id}", response_model=CaseAnalysis)
def get_case(case_id: str) -> CaseAnalysis:
    cases = get_all_cases()
    if case_id not in cases:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    return cases[case_id]


# ── Legacy demo endpoint (kept for backward compat) ──────────────────────────

@app.get("/api/demo-case", response_model=CaseAnalysis)
def get_demo_case() -> CaseAnalysis:
    return build_demo_case()


# ── AI analysis ──────────────────────────────────────────────────────────────

@app.post("/api/analyze-text", response_model=CaseAnalysis)
def analyze_text(request: AnalyzeRequest) -> CaseAnalysis:
    """Run AI analysis on provided text materials using Claude."""
    try:
        return analyze_case(request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {exc}") from exc


# ── Chat (SSE streaming) ─────────────────────────────────────────────────────

@app.post("/api/chat")
def chat_endpoint(request: ChatRequest) -> StreamingResponse:
    """Stream a chat response from Claude as Server-Sent Events."""
    try:
        return StreamingResponse(
            stream_chat(request),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Chat failed: {exc}") from exc


# ── File upload (stub — extracts text, queues for analysis) ──────────────────

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)) -> dict[str, Any]:
    """Accept a file upload and return its extracted text (stub for MVP)."""
    content = await file.read()
    mime = file.content_type or ""

    if mime.startswith("text/") or file.filename.endswith(".txt"):
        extracted_text = content.decode("utf-8", errors="replace")
    else:
        extracted_text = f"[Estrazione automatica non ancora disponibile per {mime}. Incolla il testo manualmente.]"

    return {
        "upload_id": str(uuid.uuid4()),
        "filename": file.filename,
        "mime_type": mime,
        "size_bytes": len(content),
        "extracted_text": extracted_text,
        "status": "ready" if extracted_text and not extracted_text.startswith("[") else "needs_ocr",
    }
