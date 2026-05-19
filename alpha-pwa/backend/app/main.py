from __future__ import annotations

import io
import logging
import uuid
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse

from .ai_service import analyze_case, stream_chat

logger = logging.getLogger(__name__)
from .demo_data import build_demo_case, get_all_cases, get_case_summaries
from .models import AnalyzeRequest, CaseAnalysis, CaseSummary, ChatRequest
from .ocr_adapter import MistralOcrAdapter, PptxAdapter, PypdfAdapter, XlsxAdapter
from .ocr_models import OcrInput

app = FastAPI(title="Pocket Legal Triage Alpha", version="0.2.0")

_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://localhost",
    "http://localhost",
    "capacitor://localhost",
    "https://pocket-legal-triage.netlify.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
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
    logger.info("analyze-text: title=%s, materials=%d, mode=%s, lang=%s",
                request.case_title, len(request.materials), request.mode, request.language)
    try:
        return analyze_case(request)
    except Exception as exc:
        logger.error("analyze-text failed: %s", exc, exc_info=True)
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


# ── File upload ───────────────────────────────────────────────────────────────

_pypdf = PypdfAdapter()
_mistral = MistralOcrAdapter()
_pptx = PptxAdapter()
_xlsx = XlsxAdapter()

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)) -> dict[str, Any]:
    """Extract text from uploaded file. Pipeline: text passthrough → pypdf → Mistral OCR."""
    content = await file.read()
    mime = file.content_type or ""
    filename = file.filename or "documento"

    _DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    _PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    _XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    is_text = mime.startswith("text/") or filename.lower().endswith((".txt", ".rtf", ".csv"))
    is_docx = mime == _DOCX_MIME or filename.lower().endswith(".docx")
    is_pptx = mime == _PPTX_MIME or filename.lower().endswith(".pptx")
    is_xlsx = mime == _XLSX_MIME or filename.lower().endswith(".xlsx")
    is_zip = filename.lower().endswith(".zip")
    is_rar = filename.lower().endswith(".rar")

    # ── Archivio ZIP ────────────────────────────────────────────────────────
    if is_zip:
        extracted_text = "[File ZIP rilevato. Estrai i file e caricali singolarmente: l'estrazione automatica non è supportata per sicurezza.]"
        engine = "archive-zip"
        warnings = ["I file ZIP non vengono aperti automaticamente. Estrai e carica i singoli file."]

    # ── Archivio RAR ────────────────────────────────────────────────────────
    elif is_rar:
        extracted_text = "[File RAR rilevato. Estrai i file e caricali singolarmente: il formato RAR non è supportato.]"
        engine = "archive-rar"
        warnings = ["Formato RAR non supportato. Estrai e carica i singoli file (PDF, DOCX, immagini, ecc.)."]

    # ── Plain text ───────────────────────────────────────────────────────────
    elif is_text:
        extracted_text = content.decode("utf-8", errors="replace")
        engine = "passthrough"
        warnings: list[str] = []

    # ── DOCX — python-docx ──────────────────────────────────────────────────
    elif is_docx:
        try:
            from docx import Document  # type: ignore
            doc = Document(io.BytesIO(content))
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            for table in doc.tables:
                for row in table.rows:
                    for cell in row.cells:
                        if cell.text.strip():
                            paragraphs.append(cell.text.strip())
            extracted_text = "\n\n".join(paragraphs) or "[Documento Word vuoto]"
            engine = "python-docx"
            warnings = []
        except Exception as exc:
            extracted_text = f"[Errore estrazione DOCX: {exc}]"
            engine = "python-docx-error"
            warnings = [str(exc)]

    # ── PPT/PPTX — python-pptx ──────────────────────────────────────────────
    elif is_pptx:
        result = _pptx.extract(OcrInput(content=content, mime_type=mime))
        engine = result.engine
        warnings = [w.message for w in result.warnings]
        if result.success:
            extracted_text = "\n\n".join(
                f"[Slide {p.page}]\n{p.text}" for p in result.pages
            )
        else:
            extracted_text = f"[Estrazione PPTX non riuscita: {warnings[-1] if warnings else 'Prova a convertire in PDF e ricaricare.'}]"

    # ── XLS/XLSX — openpyxl ─────────────────────────────────────────────────
    elif is_xlsx:
        result = _xlsx.extract(OcrInput(content=content, mime_type=mime))
        engine = result.engine
        warnings = [w.message for w in result.warnings]
        if result.success:
            extracted_text = "\n\n".join(
                f"[{p.text.split(chr(10))[0]}]\n" + "\n".join(p.text.split(chr(10))[1:]) for p in result.pages
            )
        else:
            extracted_text = f"[Estrazione XLSX non riuscita: {warnings[-1] if warnings else 'Prova a convertire in PDF e ricaricare.'}]"

    # ── Everything else: pypdf → Mistral OCR ─────────────────────────────────
    else:
        ocr_input = OcrInput(content=content, mime_type=mime)

        result = _pypdf.extract(ocr_input)
        if not result.success:
            result = _mistral.extract(ocr_input)

        engine = result.engine
        warnings = [w.message for w in result.warnings]

        if result.success:
            extracted_text = "\n\n".join(
                f"[Pagina {p.page}]\n{p.text}" for p in result.pages
            )
        else:
            extracted_text = f"[Estrazione non riuscita per {mime}. {warnings[-1] if warnings else 'Incolla il testo manualmente.'}]"

    return {
        "upload_id": str(uuid.uuid4()),
        "filename": filename,
        "mime_type": mime,
        "size_bytes": len(content),
        "extracted_text": extracted_text,
        "engine": engine,
        "warnings": warnings,
        "status": "ready" if extracted_text and not extracted_text.startswith("[") else "needs_ocr",
    }


# ── Voice transcription ───────────────────────────────────────────────────────

@app.post("/api/transcribe")
async def transcribe_audio(file: UploadFile = File(...)) -> dict[str, Any]:
    """Transcribe audio via Groq Whisper. Accepts webm, mp4, mp3, wav, ogg, m4a."""
    import os
    groq_key = os.environ.get("GROQ_API_KEY")
    if not groq_key:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY non configurata")

    content = await file.read()
    filename = file.filename or "audio.webm"

    from groq import Groq  # type: ignore
    client = Groq(api_key=groq_key)

    transcription = client.audio.transcriptions.create(
        file=(filename, content),
        model="whisper-large-v3-turbo",
        language="it",
        response_format="text",
    )

    return {"text": transcription if isinstance(transcription, str) else transcription.text}


# ── Brief → DOCX export ───────────────────────────────────────────────────────

from pydantic import BaseModel as _BaseModel

class BriefExportRequest(_BaseModel):
    case_title: str
    brief_markdown: str

@app.post("/api/export-brief")
def export_brief(req: BriefExportRequest) -> Response:
    """Convert brief_markdown to a DOCX file and return it for download."""
    import re as _re
    from docx import Document
    from docx.shared import Pt, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH

    doc = Document()

    # Title
    title_par = doc.add_heading(req.case_title, level=0)
    title_par.alignment = WD_ALIGN_PARAGRAPH.CENTER

    for line in req.brief_markdown.splitlines():
        stripped = line.strip()
        if not stripped:
            doc.add_paragraph('')
            continue
        # Headings
        if stripped.startswith('### '):
            doc.add_heading(stripped[4:], level=3)
        elif stripped.startswith('## '):
            doc.add_heading(stripped[3:], level=2)
        elif stripped.startswith('# '):
            doc.add_heading(stripped[2:], level=1)
        # List items
        elif stripped.startswith('- ') or stripped.startswith('* '):
            p = doc.add_paragraph(style='List Bullet')
            _add_inline(p, stripped[2:])
        # Normal paragraph
        else:
            p = doc.add_paragraph()
            _add_inline(p, stripped)

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    safe_name = _re.sub(r'[^\w\-]', '_', req.case_title)[:60]
    return Response(
        content=buf.read(),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.docx"'},
    )

def _add_inline(paragraph, text: str) -> None:
    """Add a paragraph run with basic bold/italic support."""
    import re as _re
    parts = _re.split(r'(\*\*[^*]+\*\*|\*[^*]+\*)', text)
    for part in parts:
        if part.startswith('**') and part.endswith('**'):
            run = paragraph.add_run(part[2:-2])
            run.bold = True
        elif part.startswith('*') and part.endswith('*'):
            run = paragraph.add_run(part[1:-1])
            run.italic = True
        else:
            paragraph.add_run(part)
