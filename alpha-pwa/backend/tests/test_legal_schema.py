from app.models import CaseAnalysis, DefenseStrategy, ProceduralDeadline


def test_procedural_deadline_tracks_feriale_application_with_safe_default():
    deadline = ProceduralDeadline(title="Termine memoria")

    assert deadline.feriale_applied is False
    assert deadline.model_dump()["feriale_applied"] is False


def test_defense_strategy_can_link_to_specific_charge():
    strategy = DefenseStrategy(
        title="Nullità notifica",
        target_charge_id="Capo A",
        strategy_type="procedural",
        priority="primary",
        description="Collega il motivo al capo contestato.",
        strengths=[],
        risks=[],
        required_evidence=[],
    )

    assert strategy.target_charge_id == "Capo A"


def test_null_strings_in_nested_models_are_coerced_to_empty():
    """DeepSeek often emits null for optional-looking string fields inside
    nested objects.  CaseAnalysis should convert those to empty strings
    so Pydantic validation passes."""
    raw = {
        "case_id": "test-null-fix",
        "case_title": "Test",
        "language": "it",
        "case_summary": None,  # top-level null → ""
        "materials": [],
        "timeline": [
            {
                "title": None,  # nested null → ""
                "description": "Evento",
                "source_refs": [],
                "confidence": 0.8,
            }
        ],
        "people": [],
        "evidence": [],
        "open_questions": [],
        "missing_documents": [],
        "contradictions": [],
        "procedural_deadlines": [
            {
                "title": "Udienza",
                "due_date": None,  # nested null → ""
                "description": None,  # nested null → ""
                "source_refs": [],
            }
        ],
        "brief_markdown": None,  # top-level null → ""
        "usage_estimate": {},
        "legal_analysis": {
            "risk_level": "medium",
            "risk_summary": "Test",
            "immediate_actions": [],
            "charges": [
                {
                    "charge_code": "Capo A",
                    "charge_name": "Furto",
                    "max_sentence": None,  # nested null → ""
                    "elements_required": [
                        {
                            "element": "Sottrazione",
                            "description": None,  # deeply nested null → ""
                            "status": "proven",
                            "notes": "",
                            "source_refs": [],
                        }
                    ],
                    "available_defenses": [],
                    "prosecution_strength": 0.5,
                    "notes": "",
                    "source_refs": [],
                }
            ],
            "strategies": [],
            "constitutional_issues": [],
            "witness_assessments": [],
            "evidence_balance": {"prosecution_strength": 0.5, "defense_strength": 0.3, "key_prosecution_evidence": [], "key_defense_evidence": [], "critical_gaps": [], "overall_assessment": ""},
            "client_summary": "",
        },
    }

    case = CaseAnalysis.model_validate(raw)

    # Top-level nulls became ""
    assert case.case_summary == ""
    assert case.brief_markdown == ""

    # Nested nulls in timeline became ""
    assert case.timeline[0].title == ""

    # Nested nulls in deadlines became ""
    assert case.procedural_deadlines[0].due_date == ""
    assert case.procedural_deadlines[0].description == ""

    # Deeply nested nulls in charges → elements became ""
    assert case.legal_analysis.charges[0].max_sentence == ""
    assert case.legal_analysis.charges[0].elements_required[0].description == ""


def test_procedural_deadline_nulls_coerced():
    """Direct test: ProceduralDeadline converts null required strings to empty."""
    d = ProceduralDeadline(title=None, due_date=None, description=None)
    assert d.title == ""
    assert d.due_date == ""
    assert d.description == ""
