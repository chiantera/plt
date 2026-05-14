from __future__ import annotations

from abc import ABC, abstractmethod

from .ocr_models import OcrInput, OcrPage, OcrResult, OcrWarning


class OcrAdapter(ABC):
    """Stable boundary between case analysis and replaceable OCR engines."""

    engine: str

    @abstractmethod
    def extract(self, request: OcrInput) -> OcrResult:
        """Return normalized OCR text, page refs, confidence, and warnings."""


class TextOnlyOcrAdapter(OcrAdapter):
    """Alpha contract stub.

    This intentionally does not run OCR. It only passes through text/plain input
    so downstream code can integrate against the normalized OCR contract before
    DeepSeek-OCR-2, Rust, or hosted engines are selected.
    """

    engine = "text-only-placeholder"

    def extract(self, request: OcrInput) -> OcrResult:
        if request.mime_type != "text/plain":
            return OcrResult(
                success=False,
                engine=self.engine,
                pages=[],
                warnings=[
                    OcrWarning(
                        code="unsupported_mime_type",
                        message=(
                            "text-only-placeholder only supports text/plain "
                            "in the alpha contract stub."
                        ),
                    )
                ],
            )

        raw_content = request.content
        if raw_content is None and request.file_path is not None:
            raw_content = request.file_path.read_bytes()

        text = (raw_content or b"").decode("utf-8")
        return OcrResult(
            success=True,
            engine=self.engine,
            pages=[OcrPage(page=1, text=text, confidence=1.0, blocks=[])],
            warnings=[
                OcrWarning(
                    code="placeholder_engine",
                    message="Text/plain passthrough only; no OCR inference was run.",
                    severity="warning",
                )
            ],
        )
