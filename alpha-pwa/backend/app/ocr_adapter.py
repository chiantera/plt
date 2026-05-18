from __future__ import annotations

import base64
import io
import os
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


class PypdfAdapter(OcrAdapter):
    """Extract text from native (non-scanned) PDFs using pypdf — free, instant, local.

    Returns success=False for non-PDF input or PDFs with no extractable text
    (e.g. scanned-only), so the caller can fall back to MistralOcrAdapter.
    """

    engine = "pypdf"

    def extract(self, request: OcrInput) -> OcrResult:
        if request.mime_type != "application/pdf":
            return OcrResult(
                success=False, engine=self.engine, pages=[],
                warnings=[OcrWarning(code="unsupported_mime_type", message=f"pypdf only handles application/pdf, got {request.mime_type}")],
            )

        try:
            import pypdf  # noqa: PLC0415
        except ImportError:
            return OcrResult(
                success=False, engine=self.engine, pages=[],
                warnings=[OcrWarning(code="missing_dependency", message="pypdf not installed", severity="error")],
            )

        content = request.content
        if content is None and request.file_path is not None:
            content = request.file_path.read_bytes()
        if not content:
            return OcrResult(success=False, engine=self.engine, pages=[],
                             warnings=[OcrWarning(code="empty_content", message="No content provided")])

        reader = pypdf.PdfReader(io.BytesIO(content))
        pages: list[OcrPage] = []
        for i, page in enumerate(reader.pages, start=1):
            text = (page.extract_text() or "").strip()
            if text:
                pages.append(OcrPage(page=i, text=text, confidence=1.0, blocks=[]))

        if not pages:
            return OcrResult(
                success=False, engine=self.engine, pages=[],
                warnings=[OcrWarning(code="no_text_layer", message="PDF has no extractable text layer — likely scanned. Try MistralOcrAdapter.")],
            )

        return OcrResult(success=True, engine=self.engine, pages=pages, warnings=[])


class MistralOcrAdapter(OcrAdapter):
    """OCR via Mistral OCR API (mistral-ocr-latest).

    Handles scanned PDFs and images. Requires MISTRAL_API_KEY env var.
    Returns markdown-formatted text per page.
    """

    engine = "mistral-ocr"

    def extract(self, request: OcrInput) -> OcrResult:
        api_key = os.environ.get("MISTRAL_API_KEY", "")
        if not api_key:
            return OcrResult(
                success=False, engine=self.engine, pages=[],
                warnings=[OcrWarning(code="missing_api_key", message="MISTRAL_API_KEY not set", severity="error")],
            )

        try:
            from mistralai import Mistral  # noqa: PLC0415
        except ImportError:
            return OcrResult(
                success=False, engine=self.engine, pages=[],
                warnings=[OcrWarning(code="missing_dependency", message="mistralai not installed", severity="error")],
            )

        content = request.content
        if content is None and request.file_path is not None:
            content = request.file_path.read_bytes()
        if not content:
            return OcrResult(success=False, engine=self.engine, pages=[],
                             warnings=[OcrWarning(code="empty_content", message="No content provided")])

        is_pdf = request.mime_type == "application/pdf"
        doc_type = "document_url" if is_pdf else "image_url"
        b64 = base64.standard_b64encode(content).decode()
        data_url = f"data:{request.mime_type};base64,{b64}"

        client = Mistral(api_key=api_key)
        response = client.ocr.process(
            model="mistral-ocr-latest",
            document={"type": doc_type, doc_type: data_url},
        )

        pages: list[OcrPage] = []
        for p in response.pages:
            text = (p.markdown or "").strip()
            if text:
                pages.append(OcrPage(page=p.index + 1, text=text, confidence=0.95, blocks=[]))

        if not pages:
            return OcrResult(success=False, engine=self.engine, pages=[],
                             warnings=[OcrWarning(code="empty_result", message="Mistral OCR returned no text")])

        return OcrResult(success=True, engine=self.engine, pages=pages, warnings=[])
