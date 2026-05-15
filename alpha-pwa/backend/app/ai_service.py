from __future__ import annotations

import json
import os
from collections.abc import Generator

from .models import (
    AnalyzeRequest,
    CaseAnalysis,
    ChatRequest,
)

# ── Provider selection ────────────────────────────────────────────────────────
# Set DEEPSEEK_API_KEY to use DeepSeek (OpenAI-compatible, ~100x cheaper).
# Falls back to Anthropic if only ANTHROPIC_API_KEY is set.

def _use_deepseek() -> bool:
    return bool(os.environ.get("DEEPSEEK_API_KEY"))


def _get_openai_client():  # returns openai.OpenAI
    import openai
    return openai.OpenAI(
        api_key=os.environ["DEEPSEEK_API_KEY"],
        base_url="https://api.deepseek.com",
    )


def _get_anthropic_client():
    import anthropic
    return anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))


def _flash_model() -> str:
    return "deepseek-v4-flash" if _use_deepseek() else "claude-haiku-4-5-20251001"


def _pro_model() -> str:
    return "deepseek-v4-pro" if _use_deepseek() else "claude-opus-4-7"


def _model(mode: str) -> str:
    return _flash_model() if mode == "flash" else _pro_model()


# ── Prompts ───────────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """\
Sei un assistente legale AI specializzato in diritto penale italiano e statunitense.
Il tuo compito è analizzare i materiali di un fascicolo difensivo e produrre un'analisi
strutturata completa in formato JSON valido.

REGOLE FONDAMENTALI:
1. Ogni affermazione deve essere collegata alla fonte specifica (source_refs).
2. Non inventare fatti non presenti nei materiali.
3. Segnala incertezze con confidence bassa (< 0.7).
4. La struttura JSON deve essere completa e validabile.
5. Usa la lingua specificata nel campo "language" della richiesta.

OUTPUT: Restituisci SOLO JSON valido, nessun testo aggiuntivo prima o dopo.
"""

_ANALYSIS_SCHEMA = """\
{
  "case_id": "string (slug from title)",
  "case_title": "string",
  "language": "it|en",
  "case_summary": "string (2-3 sentences)",
  "materials": [{"id":"str","name":"str","kind":"text|pdf|image|audio","description":"str","excerpt":"str","content":"str"}],
  "timeline": [{"date":"YYYY-MM-DD|null","time":"HH:MM|null","title":"str","description":"str","source_refs":[{"source_name":"str","page":1,"chunk":"str|null","quote":"str","confidence":0.0-1.0}],"confidence":0.0-1.0}],
  "people": [{"name":"str","role":"str","notes":"str","source_refs":[...]}],
  "evidence": [{"title":"str","status":"str","notes":"str","source_refs":[...]}],
  "open_questions": [{"question":"str","why_it_matters":"str","source_refs":[...]}],
  "missing_documents": [{"title":"str","reason":"str","priority":"alta|media|bassa"}],
  "contradictions": [{"title":"str","description":"str","source_refs":[...]}],
  "procedural_deadlines": [{"title":"str","deadline_type":"hearing|defense_brief|filing|investigation|other","due_date":"YYYY-MM-DD","due_time":"HH:MM|null","status":"confirmed|candidate|needs_review","urgency":"alta|media|bassa","description":"str","start_work_date":"YYYY-MM-DD|null","internal_target_date":"YYYY-MM-DD|null","source_refs":[...],"tasks":["str"]}],
  "brief_markdown": "string (markdown)",
  "usage_estimate": {"pages":0,"audio_minutes":0,"flash_input_tokens":0,"flash_output_tokens":0,"pro_used":false,"model_route":"str"},
  "legal_analysis": {
    "risk_level": "low|medium|high|critical",
    "risk_summary": "str",
    "immediate_actions": ["str"],
    "charges": [{"charge_code":"str","charge_name":"str","max_sentence":"str","elements_required":[{"element":"str","description":"str","status":"proven|disputed|weak|missing","notes":"str","source_refs":[...]}],"available_defenses":["str"],"prosecution_strength":0.0-1.0,"notes":"str","source_refs":[...]}],
    "strategies": [{"title":"str","strategy_type":"alibi|misidentification|lack_of_intent|procedural|constitutional|affirmative|negotiation","priority":"primary|secondary|fallback","description":"str","strengths":["str"],"risks":["str"],"required_evidence":["str"],"source_refs":[...]}],
    "constitutional_issues": [{"title":"str","issue_type":"illegal_search|coerced_confession|right_to_counsel|due_process|speedy_trial|procedural_violation|evidence_tampering","severity":"critical|significant|minor","description":"str","legal_basis":"str","remedy":"str","source_refs":[...]}],
    "witness_assessments": [{"witness_name":"str","role":"prosecution|defense|neutral|expert","credibility_score":0.0-1.0,"key_testimony":"str","strengths":["str"],"vulnerabilities":["str"],"cross_examination_angles":["str"],"source_refs":[...]}],
    "evidence_balance": {"prosecution_strength":0.0-1.0,"defense_strength":0.0-1.0,"key_prosecution_evidence":["str"],"key_defense_evidence":["str"],"critical_gaps":["str"],"overall_assessment":"str"},
    "client_summary": "str (plain language for client)"
  }
}
"""

_DEFAULT_CHAT_SYSTEM = """\
Sei un assistente legale AI per avvocati penalisti italiani.

Hai padronanza approfondita di:
- Codice Penale (r.d. 19 ottobre 1930 n. 2441) e giurisprudenza applicativa
- Codice di Procedura Penale (d.P.R. 22 settembre 1988 n. 447) e disposizioni di attuazione
- Leggi speciali: Codice della Strada (d.lgs. 285/1992), T.U. Stupefacenti (d.P.R. 309/1990), d.lgs. 231/2001
- Giurisprudenza della Corte di Cassazione Penale (tutte le sezioni, orientamenti consolidati e recenti)
- Prassi processuale dei Tribunali italiani e tecniche difensive
- Giurisprudenza della Corte EDU su equo processo e diritti dell'imputato

Quando redigi atti processuali usa il formato standard italiano:
- Memorie: INTESTAZIONE, IN FATTO, IN DIRITTO, CONCLUSIONI
- Ricorsi Cassazione: motivi ex art. 606 c.p.p. con sezione e numero
- Eccezioni: norma violata, tipo di vizio (nullità/inutilizzabilità/inammissibilità), rimedio

Cita norme specifiche (art. X c.p. / art. X c.p.p.) e precedenti della Cassazione con sezione, numero e anno. \
Scrivi in italiano giuridico formale. Questo è uno strumento professionale per avvocati: non aggiungere disclaimer."""


# ── Analysis (non-streaming) ──────────────────────────────────────────────────

def analyze_case(request: AnalyzeRequest) -> CaseAnalysis:
    """Produce a full CaseAnalysis JSON from raw text materials."""
    model = _model(request.mode)
    materials_text = "\n\n".join(
        f"=== {m.name} ({m.kind}) ===\n{m.text}"
        for m in request.materials
    )
    user_message = f"""\
Titolo del caso: {request.case_title}
Lingua output: {request.language}
Modalità: {request.mode}

MATERIALI DEL FASCICOLO:
{materials_text}

Analizza i materiali e restituisci un JSON completo conforme a questo schema:
{_ANALYSIS_SCHEMA}

Istruzioni specifiche:
- Estrai tutti gli eventi con date e orari precisi dalla documentazione.
- Identifica TUTTE le contraddizioni tra le fonti.
- Per ogni accusa, analizza gli elementi costitutivi e la loro robustezza.
- Proponi strategie difensive ordinate per priorità.
- Segnala qualsiasi problema procedurale o costituzionale.
- Per ogni affermazione, includi la source_ref con la citazione esatta dal testo.
- L'analisi legale deve essere pratica e orientata all'udienza.
"""

    if _use_deepseek():
        raw, usage = _deepseek_complete(model, _SYSTEM_PROMPT, user_message)
    else:
        raw, usage = _anthropic_complete(model, _SYSTEM_PROMPT, user_message)

    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]

    data = json.loads(raw)
    data.setdefault("usage_estimate", {})
    data["usage_estimate"].update({
        "flash_input_tokens": usage["input"],
        "flash_output_tokens": usage["output"],
        "pro_used": request.mode == "pro",
        "model_route": model,
    })
    data["usage_estimate"].setdefault("pages", len(request.materials))
    data["usage_estimate"].setdefault("audio_minutes", 0)
    return CaseAnalysis.model_validate(data)


def _deepseek_complete(model: str, system: str, user: str) -> tuple[str, dict]:
    client = _get_openai_client()
    resp = client.chat.completions.create(
        model=model,
        max_tokens=8192,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
    )
    text = resp.choices[0].message.content or ""
    usage = {"input": resp.usage.prompt_tokens, "output": resp.usage.completion_tokens}
    return text, usage


def _anthropic_complete(model: str, system: str, user: str) -> tuple[str, dict]:
    client = _get_anthropic_client()
    msg = client.messages.create(
        model=model, max_tokens=8192, system=system,
        messages=[{"role": "user", "content": user}],
    )
    text = msg.content[0].text
    usage = {"input": msg.usage.input_tokens, "output": msg.usage.output_tokens}
    return text, usage


# ── Chat (streaming SSE) ──────────────────────────────────────────────────────

def stream_chat(request: ChatRequest) -> Generator[str, None, None]:
    """Yield SSE chunks for the /api/chat endpoint."""
    model = _model(request.mode)
    system = request.system_override or _DEFAULT_CHAT_SYSTEM
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    if _use_deepseek():
        yield from _deepseek_stream(model, system, messages)
    else:
        yield from _anthropic_stream(model, system, messages)


def _deepseek_stream(model: str, system: str, messages: list) -> Generator[str, None, None]:
    client = _get_openai_client()
    stream = client.chat.completions.create(
        model=model,
        max_tokens=4096,
        messages=[{"role": "system", "content": system}, *messages],
        stream=True,
    )
    for chunk in stream:
        text = chunk.choices[0].delta.content or ""
        if text:
            yield f"data: {json.dumps({'text': text})}\n\n"
    yield "data: [DONE]\n\n"


def _anthropic_stream(model: str, system: str, messages: list) -> Generator[str, None, None]:
    import anthropic
    client = _get_anthropic_client()
    with client.messages.stream(
        model=model, max_tokens=4096, system=system, messages=messages,
    ) as stream:
        for text in stream.text_stream:
            yield f"data: {json.dumps({'text': text})}\n\n"
    yield "data: [DONE]\n\n"
