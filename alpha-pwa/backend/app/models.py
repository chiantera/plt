from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SourceRef(BaseModel):
    source_name: str = ""
    page: int | None = None
    chunk: str | None = None
    quote: str = ""
    confidence: float = Field(default=0.5, ge=0, le=1)


class Material(BaseModel):
    id: str = ""
    name: str = ""
    kind: Literal["text", "pdf", "image", "audio"] = "text"
    description: str = ""
    excerpt: str = ""
    content: str = ""


class TimelineEvent(BaseModel):
    date: str | None = None
    time: str | None = None
    title: str = ""
    description: str = ""
    source_refs: list[SourceRef] = []
    confidence: float = Field(default=0.5, ge=0, le=1)

    @model_validator(mode="before")
    @classmethod
    def _null_required_strings(cls, data: dict) -> dict:
        for field in ("title", "description"):
            if field in data and data[field] is None:
                data[field] = ""
        return data


class Person(BaseModel):
    name: str = ""
    role: str = ""
    notes: str = ""
    source_refs: list[SourceRef] = []

    @model_validator(mode="before")
    @classmethod
    def _null_required_strings(cls, data: dict) -> dict:
        for field in ("name", "role", "notes"):
            if field in data and data[field] is None:
                data[field] = ""
        return data


class EvidenceItem(BaseModel):
    title: str = ""
    status: str = ""
    notes: str = ""
    source_refs: list[SourceRef] = []

    @model_validator(mode="before")
    @classmethod
    def _null_required_strings(cls, data: dict) -> dict:
        for field in ("title", "status", "notes"):
            if field in data and data[field] is None:
                data[field] = ""
        return data


class OpenQuestion(BaseModel):
    question: str = ""
    why_it_matters: str = ""
    source_refs: list[SourceRef] = []


class MissingDocument(BaseModel):
    title: str = ""
    reason: str = ""
    priority: Literal["alta", "media", "bassa"] = "media"


class Contradiction(BaseModel):
    title: str = ""
    description: str = ""
    source_refs: list[SourceRef] = []


class ProceduralDeadline(BaseModel):
    title: str = ""
    deadline_type: Literal["hearing", "defense_brief", "filing", "investigation", "other"] = "other"
    due_date: str = ""
    due_time: str | None = None
    status: Literal["confirmed", "candidate", "needs_review"] = "needs_review"
    urgency: Literal["alta", "media", "bassa"] = "media"
    description: str = ""
    feriale_applied: bool = Field(
        default=False,
        description="True if August judicial-recess suspension was applied to this candidate deadline.",
    )
    start_work_date: str | None = None
    internal_target_date: str | None = None
    source_refs: list[SourceRef] = []
    tasks: list[str] = []

    @model_validator(mode="before")
    @classmethod
    def _null_required_strings_to_empty(cls, data: dict) -> dict:
        for field in ("title", "due_date", "description"):
            if field in data and data[field] is None:
                data[field] = ""
        return data


class UsageEstimate(BaseModel):
    pages: int = 0
    audio_minutes: int = 0
    flash_input_tokens: int = 0
    flash_output_tokens: int = 0
    pro_used: bool = False
    model_route: str = "unknown"


class ProRecommendation(BaseModel):
    """Non-binding upgrade prompt. It must never trigger billing by itself."""
    recommended: bool = False
    reasons: list[str] = []
    message: str = ""
    cta_label: str = "Avvia Analisi Pro"
    alternate_label: str = "Continua con analisi standard"
    requires_confirmation: bool = True
    auto_charge: bool = False


# ── Legal Analysis models ────────────────────────────────────────────────────

class ChargeElement(BaseModel):
    """A single element of the offense that prosecution must prove."""
    element: str
    description: str
    status: Literal["proven", "disputed", "weak", "missing"]
    notes: str
    source_refs: list[SourceRef] = []

    @model_validator(mode="before")
    @classmethod
    def _null_required_strings(cls, data: dict) -> dict:
        for field in ("element", "description", "notes"):
            if field in data and data[field] is None:
                data[field] = ""
        return data


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

    @model_validator(mode="before")
    @classmethod
    def _null_required_strings(cls, data: dict) -> dict:
        for field in ("charge_code", "charge_name", "max_sentence", "notes"):
            if field in data and data[field] is None:
                data[field] = ""
        return data


class DefenseStrategy(BaseModel):
    """A specific defense strategy with priority, strengths, and risks."""
    title: str
    target_charge_id: str | None = Field(
        default=None,
        description="Exact charge/capo identifier this strategy addresses, e.g. 'Capo A'.",
    )
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
    prosecution_strength: float = Field(default=0.5, ge=0, le=1)
    defense_strength: float = Field(default=0.5, ge=0, le=1)
    key_prosecution_evidence: list[str] = []
    key_defense_evidence: list[str] = []
    critical_gaps: list[str] = []
    overall_assessment: str = ""


class LegalAnalysis(BaseModel):
    """Full legal analysis container — the engine of the defense triage."""
    risk_level: Literal["low", "medium", "high", "critical"] = "medium"
    risk_summary: str = ""
    immediate_actions: list[str] = []
    charges: list[ChargeAnalysis] = []
    strategies: list[DefenseStrategy] = []
    constitutional_issues: list[ConstitutionalIssue] = []
    witness_assessments: list[WitnessAssessment] = []
    evidence_balance: EvidenceBalance | None = None
    client_summary: str = ""


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
    model_config = ConfigDict(extra="ignore")
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
    pro_recommendation: ProRecommendation = ProRecommendation()
    legal_analysis: LegalAnalysis | None = None

    @model_validator(mode="before")
    @classmethod
    def _null_lists_to_empty(cls, data: dict) -> dict:
        """Convert null list fields to empty lists (DeepSeek often emits null for empty arrays)."""
        list_fields = ["materials", "timeline", "people", "evidence", "open_questions",
                       "missing_documents", "contradictions", "procedural_deadlines"]
        for field in list_fields:
            if field in data and data[field] is None:
                data[field] = []
        return data

    @model_validator(mode="before")
    @classmethod
    def _null_strings_to_empty(cls, data: dict) -> dict:
        """Convert null string fields to empty strings."""
        str_fields = ["case_summary", "brief_markdown"]
        for field in str_fields:
            if field in data and data[field] is None:
                data[field] = ""
        return data


# ── Request / response for AI analysis ──────────────────────────────────────

class FetchUrlRequest(BaseModel):
    url: str
    name: str = ""


class AnalyzeMaterialInput(BaseModel):
    name: str
    kind: Literal["text", "pdf", "image", "audio"]
    text: str
    category: Literal["fascicolo", "giurisprudenza"] = "fascicolo"


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
