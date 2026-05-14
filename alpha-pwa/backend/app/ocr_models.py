from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class OcrInput(BaseModel):
    """Engine-neutral OCR request.

    The alpha contract accepts either uploaded bytes or a local file path. Real OCR
    engines can add their own adapters later without leaking their request shape
    into the rest of the backend.
    """

    content: bytes | None = None
    file_path: Path | None = None
    mime_type: str
    language_hint: str = "it"
    page_range: tuple[int, int] | None = None

    @model_validator(mode="after")
    def require_content_or_file_path(self) -> "OcrInput":
        if self.content is None and self.file_path is None:
            raise ValueError("OcrInput requires either content bytes or a file_path")
        return self


class OcrBlock(BaseModel):
    """Optional layout block preserved for future OCR engines."""

    text: str
    confidence: float | None = Field(default=None, ge=0, le=1)
    bbox: list[float] | None = None
    kind: str | None = None


class OcrPage(BaseModel):
    page: int = Field(ge=1)
    text: str
    confidence: float = Field(ge=0, le=1)
    blocks: list[OcrBlock] = Field(default_factory=list)


class OcrWarning(BaseModel):
    code: str
    message: str
    severity: Literal["info", "warning", "error"] = "warning"
    page: int | None = Field(default=None, ge=1)


class OcrResult(BaseModel):
    success: bool
    engine: str
    pages: list[OcrPage]
    warnings: list[OcrWarning] = Field(default_factory=list)
