from app.ai_service import _build_analysis_prompt
from app.models import AnalyzeMaterialInput, AnalyzeRequest


def _request(**overrides) -> AnalyzeRequest:
    data = {
        "case_title": "Rossi",
        "materials": [AnalyzeMaterialInput(name="Verbale", kind="text", text="notifica del 12/03")],
        "mode": "flash",
        "language": "it",
    }
    data.update(overrides)
    return AnalyzeRequest(**data)


def _prompt(request: AnalyzeRequest) -> str:
    _model, user_message, _max_tok = _build_analysis_prompt(request)
    return user_message


def test_analyze_request_accepts_optional_user_instructions():
    req = _request(user_instructions="Concentrati sui vizi di notifica.")
    assert req.user_instructions == "Concentrati sui vizi di notifica."
    # Default stays None when the field is omitted.
    assert _request().user_instructions is None


def test_lawyer_instructions_are_woven_into_the_prompt():
    prompt = _prompt(_request(user_instructions="Concentrati sui vizi di notifica, ignora il merito."))
    assert "ISTRUZIONI DELL'AVVOCATO" in prompt
    assert "Concentrati sui vizi di notifica, ignora il merito." in prompt
    # The block sits above the case materials...
    assert prompt.index("ISTRUZIONI DELL'AVVOCATO") < prompt.index("MATERIALI DEL FASCICOLO")
    # ...and the no-inventing guardrail still survives below it.
    assert "non inventare strategia difensiva" in prompt


def test_no_lawyer_block_when_instructions_absent_or_blank():
    assert "ISTRUZIONI DELL'AVVOCATO" not in _prompt(_request())
    assert "ISTRUZIONI DELL'AVVOCATO" not in _prompt(_request(user_instructions="   "))
