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


# ── Legal Analysis models ────────────────────────────────────────────────────

class ChargeElement(BaseModel):
    """A single element of the offense that prosecution must prove."""
    element: str
    description: str
    status: Literal["proven", "disputed", "weak", "missing"]
    notes: str
    source_refs: list[SourceRef] = []


class ChargeAnalysis(BaseModel):
    """Full analysis of a single criminal charge."""
    charge_code: str
    charge_name: str
    max_sentence: str
    elements_required: list[ChargeElement]
    available_defenses: list[str]
    prosecution_strength: float = Field(ge=0, le=1)
    notes: str
    source_refs: list[SourceRef] = []


class DefenseStrategy(BaseModel):
    """A specific defense strategy with priority, strengths, and risks."""
    title: str
    strategy_type: Literal[
        "alibi", "misidentification", "lack_of_intent",
        "procedural", "constitutional", "affirmative", "negotiation"
    ]
    priority: Literal["primary", "secondary", "fallback"]
    description: str
    strengths: list[str]
    risks: list[str]
    required_evidence: list[str]
    source_refs: list[SourceRef] = []


class ConstitutionalIssue(BaseModel):
    """A potential constitutional or procedural rights violation."""
    title: str
    issue_type: Literal[
        "illegal_search", "coerced_confession", "right_to_counsel",
        "due_process", "speedy_trial", "procedural_violation", "evidence_tampering"
    ]
    severity: Literal["critical", "significant", "minor"]
    description: str
    legal_basis: str
    remedy: str
    source_refs: list[SourceRef] = []


class WitnessAssessment(BaseModel):
    """Credibility analysis and cross-examination preparation for a witness."""
    witness_name: str
    role: Literal["prosecution", "defense", "neutral", "expert"]
    credibility_score: float = Field(ge=0, le=1)
    key_testimony: str
    strengths: list[str]
    vulnerabilities: list[str]
    cross_examination_angles: list[str]
    source_refs: list[SourceRef] = []


class EvidenceBalance(BaseModel):
    """Overall prosecution vs. defense evidence strength assessment."""
    prosecution_strength: float = Field(ge=0, le=1)
    defense_strength: float = Field(ge=0, le=1)
    key_prosecution_evidence: list[str]
    key_defense_evidence: list[str]
    critical_gaps: list[str]
    overall_assessment: str


class LegalAnalysis(BaseModel):
    """Full legal analysis container — the engine of the defense triage."""
    risk_level: Literal["low", "medium", "high", "critical"]
    risk_summary: str
    immediate_actions: list[str]
    charges: list[ChargeAnalysis]
    strategies: list[DefenseStrategy]
    constitutional_issues: list[ConstitutionalIssue]
    witness_assessments: list[WitnessAssessment]
    evidence_balance: EvidenceBalance
    client_summary: str


# ── Case list model ──────────────────────────────────────────────────────────

class CaseSummary(BaseModel):
    case_id: str
    case_title: str
    client_name: str
    case_summary: str
    charge_summary: str
    next_deadline_date: str | None
    next_deadline_title: str | None
    contradiction_count: int
    material_count: int
    risk_level: Literal["low", "medium", "high", "critical"] | None
    status: Literal["active", "closed", "archived"] = "active"
    created_at: str


# ── Root case model ──────────────────────────────────────────────────────────

class CaseAnalysis(BaseModel):
    case_id: str
    case_title: str
    language: Literal["it", "en"] = "it"
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
    legal_analysis: LegalAnalysis | None = None


# ── Request / response for AI analysis ──────────────────────────────────────

class AnalyzeMaterialInput(BaseModel):
    name: str
    kind: Literal["text", "pdf", "image", "audio"]
    text: str


class AnalyzeRequest(BaseModel):
    case_title: str
    materials: list[AnalyzeMaterialInput]
    mode: Literal["flash", "pro"] = "flash"
    language: Literal["it", "en"] = "it"


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    system_override: str | None = None
    mode: Literal["flash", "pro"] = "flash"
