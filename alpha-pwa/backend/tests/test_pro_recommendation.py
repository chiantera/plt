from app.ai_service import _analysis_prompt_policy, _build_pro_recommendation
from app.models import (
    CaseAnalysis,
    Contradiction,
    MissingDocument,
    ProceduralDeadline,
    ProRecommendation,
    UsageEstimate,
)


def minimal_case(**overrides) -> CaseAnalysis:
    data = {
        "case_id": "rossi",
        "case_title": "Rossi",
        "language": "it",
        "case_summary": "Sintesi",
        "materials": [],
        "timeline": [],
        "people": [],
        "evidence": [],
        "open_questions": [],
        "missing_documents": [],
        "contradictions": [],
        "procedural_deadlines": [],
        "brief_markdown": "",
        "usage_estimate": UsageEstimate(),
        "legal_analysis": None,
    }
    data.update(overrides)
    return CaseAnalysis(**data)


def test_flash_prompt_policy_extracts_without_strategy():
    policy = _analysis_prompt_policy("flash")

    assert "Extract, structure, do not over-reason" in policy
    assert "If uncertain, mark as candidate" in policy
    assert "Do not infer legal strategy" in policy
    assert "Reason deeply" not in policy


def test_pro_prompt_policy_demands_deep_source_linked_reasoning():
    policy = _analysis_prompt_policy("pro")

    assert "Reason deeply across the entire case state" in policy
    assert "Identify contradictions, procedural risks, defensive hypotheses, missing evidence, and next actions" in policy
    assert "Tie every factual claim to source references" in policy
    assert "ABSOLUTE BAN" in policy
    assert "DA VERIFICARE" in policy


def test_pro_recommendation_collects_triggers_without_auto_charging():
    case = minimal_case(
        contradictions=[Contradiction(title="Versioni incompatibili", description="Tizio e Caio collocano l'indagato in luoghi diversi")],
        missing_documents=[MissingDocument(title="Verbale sommarie informazioni", reason="Citato ma non allegato", priority="alta")],
        procedural_deadlines=[ProceduralDeadline(title="Deposito lista testi", due_date="", status="candidate", urgency="alta")],
    )

    rec = _build_pro_recommendation(case, mode="flash")

    assert isinstance(rec, ProRecommendation)
    assert rec.recommended is True
    assert rec.requires_confirmation is True
    assert rec.auto_charge is False
    assert rec.cta_label == "Avvia Analisi Pro"
    assert rec.alternate_label == "Continua con analisi standard"
    assert "contraddizioni tra versioni" in rec.message
    assert "scadenza candidata" in rec.message
    assert "documenti mancanti" in rec.message
    assert set(rec.reasons) >= {"contradictions", "candidate_deadline", "missing_key_document"}


def test_pro_recommendation_not_emitted_after_pro_run():
    case = minimal_case(contradictions=[Contradiction(title="Versioni", description="Contrasto")])

    rec = _build_pro_recommendation(case, mode="pro")

    assert rec.recommended is False
    assert rec.reasons == []
    assert rec.auto_charge is False
