import pytest
from pydantic import ValidationError

from app.ocr_adapter import TextOnlyOcrAdapter
from app.ocr_models import OcrInput, OcrPage, OcrResult, OcrWarning


def test_ocr_result_serializes_to_engine_agnostic_contract():
    result = OcrResult(
        success=True,
        engine="deepseek-ocr-2-local",
        pages=[
            OcrPage(
                page=1,
                text="Verbale di arresto del 18 aprile 2026.",
                confidence=0.94,
                blocks=[],
            )
        ],
        warnings=[],
    )

    assert result.model_dump(mode="json") == {
        "success": True,
        "engine": "deepseek-ocr-2-local",
        "pages": [
            {
                "page": 1,
                "text": "Verbale di arresto del 18 aprile 2026.",
                "confidence": 0.94,
                "blocks": [],
            }
        ],
        "warnings": [],
    }


def test_ocr_models_validate_page_numbers_and_confidence_bounds():
    with pytest.raises(ValidationError):
        OcrPage(page=0, text="bad page", confidence=0.5)

    with pytest.raises(ValidationError):
        OcrPage(page=1, text="bad confidence", confidence=1.1)


def test_text_only_adapter_normalizes_uploaded_text_bytes_without_binding_to_real_ocr():
    adapter = TextOnlyOcrAdapter()
    request = OcrInput(
        content=b"Prima pagina del fascicolo demo.",
        mime_type="text/plain",
    )

    result = adapter.extract(request)

    assert result.success is True
    assert result.engine == "text-only-placeholder"
    assert result.pages[0].page == 1
    assert result.pages[0].text == "Prima pagina del fascicolo demo."
    assert result.pages[0].confidence == 1.0
    assert result.warnings == [
        OcrWarning(
            code="placeholder_engine",
            message="Text/plain passthrough only; no OCR inference was run.",
        )
    ]


def test_text_only_adapter_returns_structured_failure_for_non_text_inputs():
    adapter = TextOnlyOcrAdapter()
    request = OcrInput(
        content=b"%PDF-1.7 fake bytes",
        mime_type="application/pdf",
        language_hint="it",
    )

    result = adapter.extract(request)

    assert result.success is False
    assert result.engine == "text-only-placeholder"
    assert result.pages == []
    assert result.warnings == [
        OcrWarning(
            code="unsupported_mime_type",
            message="text-only-placeholder only supports text/plain in the alpha contract stub.",
        )
    ]
