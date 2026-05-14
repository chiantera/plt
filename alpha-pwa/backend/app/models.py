from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class SourceRef(BaseModel):
    source_name: str
    page: int | None = None
    chunk: str | None = None
    quote: str
    confidence: float = Field(ge=0, le=1)


class Material(BaseModel):
    id: str
    name: str
    kind: Literal["text", "pdf", "image", "audio"]
    description: str
    excerpt: str
    content: str = ""


class TimelineEvent(BaseModel):
    date: str | None
    time: str | None = None
    title: str
    description: str
    source_refs: list[SourceRef]
    confidence: float = Field(ge=0, le=1)


class Person(BaseModel):
    name: str
    role: str
    notes: str
    source_refs: list[SourceRef]


class EvidenceItem(BaseModel):
    title: str
    status: str
    notes: str
    source_refs: list[SourceRef]


class OpenQuestion(BaseModel):
    question: str
    why_it_matters: str
    source_refs: list[SourceRef]


class MissingDocument(BaseModel):
    title: str
    reason: str
    priority: Literal["alta", "media", "bassa"]


class Contradiction(BaseModel):
    title: str
    description: str
    source_refs: list[SourceRef]


class ProceduralDeadline(BaseModel):
    title: str
    deadline_type: Literal["hearing", "defense_brief", "filing", "investigation", "other"]
    due_date: str
    due_time: str | None = None
    status: Literal["confirmed", "candidate", "needs_review"]
    urgency: Literal["alta", "media", "bassa"]
    description: str
    start_work_date: str | None = None
    internal_target_date: str | None = None
    source_refs: list[SourceRef]
    tasks: list[str]


class UsageEstimate(BaseModel):
    pages: int
    audio_minutes: int
    flash_input_tokens: int
    flash_output_tokens: int
    pro_used: bool
    model_route: str


class CaseAnalysis(BaseModel):
    case_id: str
    case_title: str
    language: Literal["it"]
    case_summary: str
    materials: list[Material]
    timeline: list[TimelineEvent]
    people: list[Person]
    evidence: list[EvidenceItem]
    open_questions: list[OpenQuestion]
    missing_documents: list[MissingDocument]
    contradictions: list[Contradiction]
    procedural_deadlines: list[ProceduralDeadline]
    brief_markdown: str
    usage_estimate: UsageEstimate
