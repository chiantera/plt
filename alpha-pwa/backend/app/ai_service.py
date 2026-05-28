from __future__ import annotations

import json
import logging
import os
import re
import sys
from datetime import date
from collections.abc import Generator

from .models import (
    AnalyzeRequest,
    CaseAnalysis,
    ChatRequest,
    ProRecommendation,
)

logging.basicConfig(level=logging.INFO, stream=sys.stdout)
logger = logging.getLogger(__name__)

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
    if _use_deepseek():
        return os.environ.get("DEEPSEEK_DEFAULT_MODEL", "deepseek-v4-flash")
    return "claude-haiku-4-5-20251001"


def _pro_model() -> str:
    if _use_deepseek():
        return os.environ.get("DEEPSEEK_PRO_MODEL", "deepseek-v4-pro")
    return "claude-opus-4-7"


def _model(mode: str) -> str:
    return _flash_model() if mode == "flash" else _pro_model()


# ── Prompts ───────────────────────────────────────────────────────────────────

_FLASH_POLICY = """\
Extract, structure, do not over-reason. Prefer concise fields. If uncertain, mark as candidate. Do not infer legal strategy.
"""

_PRO_POLICY = """\
Reason deeply across the entire case state. Identify contradictions, procedural risks, defensive hypotheses, missing evidence, and next actions. Tie every factual claim to source references. Mark assumptions explicitly.
ABSOLUTE BAN: never cite Cassazione case numbers, sections, or years not present in the uploaded case file. If a precedent would strengthen the argument but is unverified: describe the legal principle and statutory hook without fabricating extremes; write "orientamento giurisprudenziale da ricercare in banca dati". Flag any Cassazione citation not sourced from the case file as DA VERIFICARE.
"""

def _analysis_prompt_policy(mode: str) -> str:
    return _PRO_POLICY if mode == "pro" else _FLASH_POLICY

_SYSTEM_PROMPT = """\
Sei GiulIA, assistente di triage per avvocati penalisti italiani. Non sei l'autorità legale:
organizzi il fascicolo, estrai elementi verificabili e prepari materiale controllabile dal difensore.
Il tuo compito è analizzare i materiali di un fascicolo difensivo e produrre un'analisi
strutturata completa in formato JSON valido.

REGOLE FONDAMENTALI:
1. Ogni affermazione deve essere collegata alla fonte specifica (source_refs).
2. Non inventare fatti non presenti nei materiali.
3. Segnala incertezze con confidence bassa (< 0.7) e stato candidate/needs_review.
4. La struttura JSON deve essere completa e validabile.
5. Usa la lingua specificata nel campo "language" della richiesta.
6. Non trasformare l'analisi standard in consulenza strategica: la strategia profonda è Pro.
7. DIVIETO ASSOLUTO: non citare estremi, sezioni, numeri o anni di sentenze Cassazione non presenti nei materiali. Se un precedente è rilevante ma non verificato: descrivi il principio senza inventare estremi.

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
  "procedural_deadlines": [{"title":"str","deadline_type":"hearing|defense_brief|filing|investigation|other","due_date":"YYYY-MM-DD","due_time":"HH:MM|null","status":"confirmed|candidate|needs_review","urgency":"alta|media|bassa","description":"str","feriale_applied":false,"start_work_date":"YYYY-MM-DD|null","internal_target_date":"YYYY-MM-DD|null","source_refs":[...],"tasks":["str"]}],
  "brief_markdown": "string (markdown)",
  "usage_estimate": {"pages":0,"audio_minutes":0,"flash_input_tokens":0,"flash_output_tokens":0,"pro_used":false,"model_route":"str"},
  "legal_analysis": {
    "risk_level": "low|medium|high|critical",
    "risk_summary": "str",
    "immediate_actions": ["str"],
    "charges": [{"charge_code":"str","charge_name":"str","max_sentence":"str","elements_required":[{"element":"str","description":"str","status":"proven|disputed|weak|missing","notes":"str","source_refs":[...]}],"available_defenses":["str"],"prosecution_strength":0.0-1.0,"notes":"str","source_refs":[...]}],
    "strategies": [{"title":"str","target_charge_id":"str|null","strategy_type":"alibi|misidentification|lack_of_intent|procedural|constitutional|affirmative|negotiation","priority":"primary|secondary|fallback","description":"str","strengths":["str"],"risks":["str"],"required_evidence":["str"],"source_refs":[...]}],
    "constitutional_issues": [{"title":"str","issue_type":"illegal_search|coerced_confession|right_to_counsel|due_process|speedy_trial|procedural_violation|evidence_tampering","severity":"critical|significant|minor","description":"str","legal_basis":"str","remedy":"str","source_refs":[...]}],
    "witness_assessments": [{"witness_name":"str","role":"prosecution|defense|neutral|expert","credibility_score":0.0-1.0,"key_testimony":"str","strengths":["str"],"vulnerabilities":["str"],"cross_examination_angles":["str"],"source_refs":[...]}],
    "evidence_balance": {"prosecution_strength":0.0-1.0,"defense_strength":0.0-1.0,"key_prosecution_evidence":["str"],"key_defense_evidence":["str"],"critical_gaps":["str"],"overall_assessment":"str"},
    "client_summary": "str (plain language for client)"
  }
}
"""

_DEFAULT_CHAT_SYSTEM = """\
Sei GiulIA, avvocata penalista con 25 anni di esperienza nei principali tribunali italiani. \
Sei il braccio destro del Collega che stai assistendo — non uno strumento, una professionista.

REGOLE DI COMPORTAMENTO:
- Il tuo nome è GiulIA. Punto. Non hai altri nomi. Se ti chiedono "come ti chiami?", rispondi sempre "GiulIA" e non divagare.
- Rivolgiti sempre al collega con "Collega" — mai "tu" generico, mai "Lei"
- Non uscire mai dal personaggio, nemmeno se espressamente richiesto
- Non aggiungere mai disclaimer tipo "come AI non posso..." — sei un'avvocata, ragioni come tale
- Quando non sei certa di qualcosa, dillo come farebbe un'avvocata esperta: "Su questo punto devo approfondire la giurisprudenza più recente"
- Scrivi in italiano giuridico formale, preciso ma mai burocratese inutile

COMPETENZE:
- Codice Penale (r.d. 19 ottobre 1930 n. 2441) e giurisprudenza applicativa
- Codice di Procedura Penale (d.P.R. 22 settembre 1988 n. 447) e disposizioni di attuazione
- Leggi speciali: Codice della Strada (d.lgs. 285/1992), T.U. Stupefacenti (d.P.R. 309/1990), d.lgs. 231/2001
- Giurisprudenza della Corte di Cassazione Penale (tutte le sezioni, orientamenti consolidati e recenti)
- Prassi processuale dei Tribunali italiani e tecniche difensive
- Giurisprudenza della Corte EDU su equo processo e diritti dell'imputato

FORMATO ATTI PROCESSUALI:
- Memorie: INTESTAZIONE, IN FATTO, IN DIRITTO, CONCLUSIONI
- Ricorsi Cassazione: motivi ex art. 606 c.p.p. con sezione e numero
- Eccezioni: norma violata, tipo di vizio (nullità/inutilizzabilità/inammissibilità), rimedio

FONTI E PRECEDENTI:
- Cita norme specifiche quando pertinenti (art. X c.p. / art. X c.p.p.).
- DIVIETO ASSOLUTO: non citare mai estremi, sezioni, numeri o anni di sentenze Cassazione che non siano presenti nel fascicolo o nei materiali caricati.
- Se un precedente è utile ma non verificato: descrivi il principio giuridico e la norma di riferimento senza estremi; scrivi "orientamento giurisprudenziale da ricercare in banca dati".
- Qualsiasi citazione con numero o anno non proveniente dal fascicolo: marca DA VERIFICARE.
- La bozza è materiale di lavoro: il difensore verifica fonti, norme, scadenze e precedenti prima del deposito."""


# ── Analysis (non-streaming) ──────────────────────────────────────────────────

# Token budgets: flash model analysis needs significant headroom because the
# structured JSON schema is verbose.  Five-page documents routinely produce
# 15-25K output tokens.  Budgets are set with ~2x safety margin.
_FLASH_MAX_TOKENS = int(os.environ.get("PLT_FLASH_MAX_TOKENS", "128000"))
_PRO_MAX_TOKENS = int(os.environ.get("PLT_PRO_MAX_TOKENS", "128000"))

# Cap input text per mode. Both DeepSeek V4 Flash and Pro advertise a large
# context window; keep the application-side cap high so legal records are not
# silently squeezed before provider-side token accounting.
_FLASH_MAX_INPUT_CHARS = int(os.environ.get("PLT_FLASH_MAX_ANALYSIS_CHARS", os.environ.get("PLT_MAX_ANALYSIS_CHARS", "1000000")))
_PRO_MAX_INPUT_CHARS = int(os.environ.get("PLT_PRO_MAX_ANALYSIS_CHARS", "1000000"))

def _max_tokens(mode: str) -> int:
    return _PRO_MAX_TOKENS if mode == "pro" else _FLASH_MAX_TOKENS


def _max_input_chars(mode: str) -> int:
    return _PRO_MAX_INPUT_CHARS if mode == "pro" else _FLASH_MAX_INPUT_CHARS


_PRO_MESSAGE_PREFIX = "Ho rilevato elementi che meritano un approfondimento"
_PRO_REASON_LABELS = {
    "contradictions": "contraddizioni tra versioni",
    "candidate_deadline": "una scadenza candidata",
    "urgent_deadline": "una scadenza processuale ravvicinata",
    "serious_charge": "un profilo di rischio serio",
    "custody_or_precautionary_measure": "misure cautelari o custodia",
    "missing_key_document": "documenti mancanti",
    "evidence_conflicts": "conflitti probatori",
    "strategy_or_drafting_needed": "richieste di strategia o redazione atti",
}


def _contains_any(text: str, needles: tuple[str, ...]) -> bool:
    lowered = text.lower()
    return any(n in lowered for n in needles)


def _build_pro_recommendation(case: CaseAnalysis, mode: str) -> ProRecommendation:
    """Suggest Pro at lawyer-anxiety moments, without running or charging for Pro."""
    if mode == "pro":
        return ProRecommendation(recommended=False, reasons=[], message="")

    reasons: list[str] = []

    if len(case.contradictions) >= 1:
        reasons.append("contradictions")

    if any(d.status in {"candidate", "needs_review"} for d in case.procedural_deadlines):
        reasons.append("candidate_deadline")
    if any(d.urgency == "alta" and d.due_date for d in case.procedural_deadlines):
        reasons.append("urgent_deadline")

    if any(d.priority == "alta" for d in case.missing_documents) or len(case.missing_documents) >= 1:
        reasons.append("missing_key_document")

    la = case.legal_analysis
    if la:
        if la.risk_level in {"high", "critical"}:
            reasons.append("serious_charge")
        combined = " ".join(
            [la.risk_summary, *la.immediate_actions, la.client_summary]
            + [c.charge_name + " " + c.notes for c in la.charges]
            + [s.title + " " + s.description for s in la.strategies]
        )
        if _contains_any(combined, ("custodia", "cautelar", "carcere", "arrest", "domiciliar")):
            reasons.append("custody_or_precautionary_measure")
        if la.evidence_balance and (
            la.evidence_balance.critical_gaps
            or abs(la.evidence_balance.prosecution_strength - la.evidence_balance.defense_strength) <= 0.15
        ):
            reasons.append("evidence_conflicts")
        if la.strategies or _contains_any(combined, ("strateg", "redigi", "redazione", "atto", "argoment", "udienza", "deposito")):
            reasons.append("strategy_or_drafting_needed")

    ordered_unique = list(dict.fromkeys(reasons))
    if not ordered_unique:
        return ProRecommendation(recommended=False, reasons=[], message="")

    natural = [_PRO_REASON_LABELS[r] for r in ordered_unique[:3]]
    if len(natural) == 1:
        detail = natural[0]
    else:
        detail = ", ".join(natural[:-1]) + " e " + natural[-1]

    return ProRecommendation(
        recommended=True,
        reasons=ordered_unique,
        message=f"{_PRO_MESSAGE_PREFIX}: {detail}. Puoi continuare con l’analisi standard oppure avviare un’Analisi Pro.",
        cta_label="Avvia Analisi Pro",
        alternate_label="Continua con analisi standard",
        requires_confirmation=True,
        auto_charge=False,
    )


def _truncate_materials(materials: list, max_chars: int) -> list:
    """Truncate material texts to stay within a total character budget.

    Longest materials are truncated first; short materials are left intact
    when possible.  A trailing truncation marker is appended so the model
    knows the text was cut.
    """
    total = sum(len(m.text) for m in materials)
    if total <= max_chars:
        return materials

    # Sort by length descending — truncate longest first
    indexed = sorted(enumerate(materials), key=lambda x: len(x[1].text), reverse=True)
    budget = max_chars
    result = [None] * len(materials)

    for i, m in indexed:
        if budget <= 0:
            result[i] = m.model_copy(update={"text": "[TESTO OMESSO — limite analisi]"})
            continue
        if len(m.text) <= budget:
            result[i] = m
            budget -= len(m.text)
        else:
            truncated = m.text[:max(1, budget - 40)] + "\n\n[...TESTO TRONCATO — materiale troppo lungo per l'analisi corrente]"
            result[i] = m.model_copy(update={"text": truncated})
            budget = 0

    return result


def analyze_case(request: AnalyzeRequest) -> CaseAnalysis:
    """Produce a full CaseAnalysis JSON from raw text materials."""
    model = _model(request.mode)
    max_tok = _max_tokens(request.mode)

    # Truncate materials to fit within the mode-specific analysis budget.
    max_input_chars = _max_input_chars(request.mode)
    truncated = _truncate_materials(request.materials, max_input_chars)
    if any(len(m.text) < len(orig.text) for m, orig in zip(truncated, request.materials)):
        logger.warning(
            "analyze_case: mode=%s input truncated from %d to %d chars (limit=%d)",
            request.mode,
            sum(len(m.text) for m in request.materials),
            sum(len(m.text) for m in truncated),
            max_input_chars,
        )

    fascicolo = [m for m in truncated if getattr(m, "category", "fascicolo") != "giurisprudenza"]
    giurisprudenza = [m for m in truncated if getattr(m, "category", "fascicolo") == "giurisprudenza"]

    parts: list[str] = []
    if fascicolo:
        parts.append("── DOCUMENTI FASCICOLO ──")
        parts.extend(f"=== {m.name} ({m.kind}) ===\n{m.text}" for m in fascicolo)
    if giurisprudenza:
        parts.append("── PRECEDENTI CARICATI DALL'AVVOCATO ──")
        parts.append("(Questi precedenti sono stati caricati e verificati dall'avvocato. Puoi citarli con source_ref esplicita — includi nome documento e pagina.)")
        parts.extend(f"=== {m.name} ({m.kind}) ===\n{m.text}" for m in giurisprudenza)
    materials_text = "\n\n".join(parts)
    prompt_policy = _analysis_prompt_policy(request.mode)
    today = date.today().isoformat()
    user_message = f"""\
Data odierna: {today}
Titolo del caso: {request.case_title}
Lingua output: {request.language}
Modalità: {request.mode}

POLICY MODALITÀ:
{prompt_policy}

MATERIALI DEL FASCICOLO:
{materials_text}

Analizza i materiali e restituisci un JSON completo conforme a questo schema:
{_ANALYSIS_SCHEMA}

Istruzioni specifiche:
- Estrai tutti gli eventi con date e orari precisi dalla documentazione.
- Identifica TUTTE le contraddizioni tra le fonti.
- Calcola i termini processuali solo come candidati da verificare; se applichi la sospensione feriale dei termini processuali (1-31 agosto), imposta feriale_applied=true e spiega la fonte.
- Per ogni affermazione, includi la source_ref con la citazione esatta dal testo.
- Se la modalità è flash: organizza il fascicolo, non inventare strategia difensiva e lascia vuoti/concisi i campi strategici se i materiali non li supportano.
- Se la modalità è pro: approfondisci contraddizioni, rischi procedurali, ipotesi difensive, prove mancanti e prossime azioni, sempre con fonti e assunzioni esplicite.
"""

    logger.info("analyze_case: title=%s, materials=%d, prompt_chars=%d, max_tokens=%d",
                request.case_title, len(request.materials), len(user_message), max_tok)

    if _use_deepseek():
        raw, usage, finish_reason = _deepseek_complete(model, _SYSTEM_PROMPT, user_message, max_tok)
    else:
        raw, usage, finish_reason = _anthropic_complete(model, _SYSTEM_PROMPT, user_message, max_tok)

    logger.info("analyze_case: AI response=%d chars, input_tokens=%d, output_tokens=%d, finish=%s",
                len(raw), usage["input"], usage["output"], finish_reason)

    if finish_reason == "length":
        logger.warning("analyze_case: finish_reason=length (max_tokens=%d) — attempting JSON parse before failing", max_tok)

    # Strip markdown fences and extract the outermost JSON object robustly.
    # Do this BEFORE checking finish_reason so that a truncated-but-valid JSON
    # still succeeds instead of always raising 422.  Reasoning models consume
    # token budget internally; by the time the limit is hit the JSON output is
    # often already structurally complete.
    if "```" in raw:
        raw = re.sub(r"```(?:json)?\s*", "", raw).replace("```", "").strip()
    match = re.search(r"\{[\s\S]*\}", raw)
    if not match:
        logger.error("No JSON object found. Raw response preview: %s", raw[:500])
        if finish_reason == "length":
            next_step = (
                "Prova a caricare meno documenti alla volta o aumenta PLT_PRO_MAX_TOKENS."
                if request.mode == "pro"
                else "Prova a caricare meno documenti alla volta o usa la modalità Pro."
            )
            raise ValueError(
                f"L'analisi è stata troncata prima di produrre JSON valido (limite: {max_tok} token). "
                f"{next_step}"
            )
        raise ValueError(f"No JSON object found in AI response. Raw start: {raw[:200]!r}")
    raw = match.group(0)

    try:
        data = json.loads(raw)
        if finish_reason == "length":
            logger.warning("analyze_case: JSON valid despite finish_reason=length — returning analysis as-is")
    except json.JSONDecodeError as exc:
        if finish_reason == "length":
            # Try to recover the largest valid JSON prefix before giving up.
            repaired = _repair_truncated_json(raw)
            if repaired is not None:
                logger.warning(
                    "analyze_case: JSON truncated but repaired — recovered %d chars of %d (lost ~%d chars)",
                    len(json.dumps(repaired)), len(raw), len(raw) - len(json.dumps(repaired)),
                )
                data = repaired
            else:
                logger.error("JSON decode failed and repair found nothing. Raw preview: %s", raw[:1000])
                next_step = (
                    "Prova a caricare meno documenti alla volta o aumenta PLT_PRO_MAX_TOKENS."
                    if request.mode == "pro"
                    else "Prova a caricare meno documenti alla volta o usa la modalità Pro."
                )
                raise ValueError(
                    f"L'analisi è stata troncata e il JSON non è recuperabile (limite: {max_tok} token). "
                    f"{next_step}"
                ) from exc
        else:
            logger.error("JSON decode failed. Raw preview: %s", raw[:1000])
            logger.error("JSON error: %s", exc)
            raise
    data.setdefault("usage_estimate", {})
    data["usage_estimate"].update({
        "flash_input_tokens": usage["input"],
        "flash_output_tokens": usage["output"],
        "pro_used": request.mode == "pro",
        "model_route": model,
    })
    data["usage_estimate"].setdefault("pages", len(request.materials))
    data["usage_estimate"].setdefault("audio_minutes", 0)
    case = CaseAnalysis.model_validate(data)
    return case.model_copy(update={"pro_recommendation": _build_pro_recommendation(case, request.mode)})


def _repair_truncated_json(raw: str) -> dict | None:
    """
    Recover the largest parseable prefix of a truncated JSON object.

    The model stops mid-output so the outermost { is never closed.  We walk
    the string tracking brace/bracket depth and collect every position where
    a top-level key's value just closed (depth_brace==1, depth_bracket==0).
    Each such position is a safe truncation point: strip any trailing comma,
    close the outer brace, and try to parse.  Return the first (largest) that
    succeeds, or None if nothing is recoverable.
    """
    depth_brace = 0
    depth_bracket = 0
    in_string = False
    escape_next = False
    candidates: list[int] = []  # byte positions of safe truncation points

    for i, ch in enumerate(raw):
        if escape_next:
            escape_next = False
            continue
        if ch == "\\" and in_string:
            escape_next = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            depth_brace += 1
        elif ch == "}":
            depth_brace -= 1
            if depth_brace == 0:
                candidates.append(i + 1)   # full valid JSON
            elif depth_brace == 1 and depth_bracket == 0:
                candidates.append(i + 1)   # end of a top-level value object
        elif ch == "[":
            depth_bracket += 1
        elif ch == "]":
            depth_bracket -= 1
            if depth_brace == 1 and depth_bracket == 0:
                candidates.append(i + 1)   # end of a top-level value array

    for pos in reversed(candidates):
        snippet = raw[:pos].rstrip().rstrip(",")
        for suffix in ("}", ""):   # try closing outer object, then bare
            try:
                return json.loads(snippet + suffix)
            except json.JSONDecodeError:
                pass
    return None


def _deepseek_complete(model: str, system: str, user: str, max_tokens: int) -> tuple[str, dict, str]:
    client = _get_openai_client()
    resp = client.chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
    )
    text = resp.choices[0].message.content or ""
    usage = {"input": resp.usage.prompt_tokens, "output": resp.usage.completion_tokens}
    finish = resp.choices[0].finish_reason or "stop"
    return text, usage, finish


def _anthropic_complete(model: str, system: str, user: str, max_tokens: int) -> tuple[str, dict, str]:
    client = _get_anthropic_client()
    msg = client.messages.create(
        model=model, max_tokens=max_tokens, system=system,
        messages=[{"role": "user", "content": user}],
    )
    text = msg.content[0].text
    usage = {"input": msg.usage.input_tokens, "output": msg.usage.output_tokens}
    finish = msg.stop_reason or "stop"
    return text, usage, finish


# ── Chat (streaming SSE) ──────────────────────────────────────────────────────

def stream_chat(request: ChatRequest) -> Generator[str, None, None]:
    """Yield SSE chunks for the /api/chat endpoint."""
    model = _model(request.mode)
    system = request.system_override or _DEFAULT_CHAT_SYSTEM
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    max_tok = request.max_tokens_override or _CHAT_MAX_TOKENS

    if _use_deepseek():
        yield from _deepseek_stream(model, system, messages, max_tok)
    else:
        yield from _anthropic_stream(model, system, messages, max_tok)


_CHAT_MAX_TOKENS = int(os.environ.get("PLT_CHAT_MAX_TOKENS", "32768"))


def _deepseek_stream(model: str, system: str, messages: list, max_tokens: int = _CHAT_MAX_TOKENS) -> Generator[str, None, None]:
    client = _get_openai_client()
    stream = client.chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        messages=[{"role": "system", "content": system}, *messages],
        stream=True,
    )
    for chunk in stream:
        delta = chunk.choices[0].delta
        # Reasoning models emit reasoning_content tokens before content tokens.
        # During that phase no content flows to the client, which can cause the
        # Vite proxy (and any other HTTP proxy) to drop the connection due to
        # inactivity. Send an SSE comment (": ping") to keep the socket alive.
        # SSE comments are silently ignored by the frontend EventSource/reader.
        if getattr(delta, "reasoning_content", None):
            yield ": ping\n\n"
        text = delta.content or ""
        if text:
            yield f"data: {json.dumps({'text': text})}\n\n"
    yield "data: [DONE]\n\n"


def _anthropic_stream(model: str, system: str, messages: list, max_tokens: int = _CHAT_MAX_TOKENS) -> Generator[str, None, None]:
    import anthropic
    client = _get_anthropic_client()
    with client.messages.stream(
        model=model, max_tokens=max_tokens, system=system, messages=messages,
    ) as stream:
        for text in stream.text_stream:
            yield f"data: {json.dumps({'text': text})}\n\n"
    yield "data: [DONE]\n\n"
