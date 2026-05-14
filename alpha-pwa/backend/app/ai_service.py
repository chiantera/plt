from __future__ import annotations

import json
import os

import anthropic

from .models import (
    AnalyzeRequest,
    CaseAnalysis,
    ChargeAnalysis,
    ChargeElement,
    Contradiction,
    ConstitutionalIssue,
    DefenseStrategy,
    EvidenceBalance,
    EvidenceItem,
    LegalAnalysis,
    Material,
    MissingDocument,
    OpenQuestion,
    Person,
    ProceduralDeadline,
    SourceRef,
    TimelineEvent,
    UsageEstimate,
    WitnessAssessment,
)

_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))
    return _client


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


def analyze_case(request: AnalyzeRequest) -> CaseAnalysis:
    """Call Claude to produce a full CaseAnalysis from raw text materials."""
    client = _get_client()

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

    model = "claude-haiku-4-5-20251001" if request.mode == "flash" else "claude-opus-4-7"

    message = client.messages.create(
        model=model,
        max_tokens=8192,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]

    data = json.loads(raw)

    # Patch usage estimate with actual token counts
    data.setdefault("usage_estimate", {})
    data["usage_estimate"]["flash_input_tokens"] = message.usage.input_tokens
    data["usage_estimate"]["flash_output_tokens"] = message.usage.output_tokens
    data["usage_estimate"]["pro_used"] = request.mode == "pro"
    data["usage_estimate"]["model_route"] = model
    data["usage_estimate"].setdefault("pages", len(request.materials))
    data["usage_estimate"].setdefault("audio_minutes", 0)

    return CaseAnalysis.model_validate(data)
