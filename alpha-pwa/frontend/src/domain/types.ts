import type { DraftArtifact } from '../draftArtifacts';

export type SourceRef = {
  source_name: string;
  page: number | null;
  chunk: string | null;
  quote: string;
  confidence: number;
};

export type Material = {
  id: string;
  name: string;
  kind: string;
  description: string;
  excerpt: string;
  content: string;
};

export type TimelineEvent = {
  date: string | null;
  time: string | null;
  title: string;
  description: string;
  source_refs: SourceRef[];
  confidence: number;
};

export type Person = {
  name: string;
  role: string;
  notes: string;
  source_refs: SourceRef[];
};

export type EvidenceItem = {
  title: string;
  status: string;
  notes: string;
  source_refs: SourceRef[];
};

export type OpenQuestion = {
  question: string;
  why_it_matters: string;
  source_refs: SourceRef[];
};

export type MissingDocument = {
  title: string;
  reason: string;
  priority: 'alta' | 'media' | 'bassa';
};

export type Contradiction = {
  title: string;
  description: string;
  source_refs: SourceRef[];
};

export type ProceduralDeadline = {
  title: string;
  deadline_type: 'hearing' | 'defense_brief' | 'filing' | 'investigation' | 'other';
  due_date: string;
  due_time: string | null;
  status: 'confirmed' | 'candidate' | 'needs_review';
  urgency: 'alta' | 'media' | 'bassa';
  description: string;
  feriale_applied: boolean;
  start_work_date: string | null;
  internal_target_date: string | null;
  source_refs: SourceRef[];
  tasks: string[];
};

export type UsageEstimate = {
  pages: number;
  audio_minutes: number;
  flash_input_tokens: number;
  flash_output_tokens: number;
  pro_used: boolean;
  model_route: string;
};

export type ProRecommendation = {
  recommended: boolean;
  reasons: string[];
  message: string;
  cta_label: string;
  alternate_label: string;
  requires_confirmation: boolean;
  auto_charge: boolean;
};

export type ChargeElement = {
  element: string;
  description: string;
  status: 'proven' | 'disputed' | 'weak' | 'missing';
  notes: string;
  source_refs: SourceRef[];
};

export type ChargeAnalysis = {
  charge_code: string;
  charge_name: string;
  max_sentence: string;
  elements_required: ChargeElement[];
  available_defenses: string[];
  prosecution_strength: number;
  notes: string;
  source_refs: SourceRef[];
};

export type DefenseStrategy = {
  title: string;
  target_charge_id: string | null;
  strategy_type: string;
  priority: 'primary' | 'secondary' | 'fallback';
  description: string;
  strengths: string[];
  risks: string[];
  required_evidence: string[];
  source_refs: SourceRef[];
};

export type ConstitutionalIssue = {
  title: string;
  issue_type: string;
  severity: 'critical' | 'significant' | 'minor';
  description: string;
  legal_basis: string;
  remedy: string;
  source_refs: SourceRef[];
};

export type WitnessAssessment = {
  witness_name: string;
  role: 'prosecution' | 'defense' | 'neutral' | 'expert';
  credibility_score: number;
  key_testimony: string;
  strengths: string[];
  vulnerabilities: string[];
  cross_examination_angles: string[];
  source_refs: SourceRef[];
};

export type EvidenceBalance = {
  prosecution_strength: number;
  defense_strength: number;
  key_prosecution_evidence: string[];
  key_defense_evidence: string[];
  critical_gaps: string[];
  overall_assessment: string;
};

export type LegalAnalysis = {
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_summary: string;
  immediate_actions: string[];
  charges: ChargeAnalysis[];
  strategies: DefenseStrategy[];
  constitutional_issues: ConstitutionalIssue[];
  witness_assessments: WitnessAssessment[];
  evidence_balance: EvidenceBalance | null;
  client_summary: string;
};

export type RawDocument = {
  doc_id: string;
  name: string;
  description: string;
  text: string;
  added_at: string;
  category?: 'fascicolo' | 'giurisprudenza';
};

export type UploadQueueItem = {
  id: string;
  file: File | null;
  name: string;
  size: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  text?: string;
  error?: string;
  description?: string;
  category: 'fascicolo' | 'giurisprudenza';
};

export type RedactionRule = {
  id: string;
  original: string;
  replacement: string;
  enabled: boolean;
};

export type CaseAnalysis = {
  case_id: string;
  case_title: string;
  language: string;
  case_summary: string;
  materials: Material[];
  timeline: TimelineEvent[];
  people: Person[];
  evidence: EvidenceItem[];
  open_questions: OpenQuestion[];
  missing_documents: MissingDocument[];
  contradictions: Contradiction[];
  procedural_deadlines: ProceduralDeadline[];
  brief_markdown: string;
  usage_estimate: UsageEstimate;
  pro_recommendation?: ProRecommendation;
  legal_analysis: LegalAnalysis | null;
  is_pending?: boolean;
  raw_documents?: RawDocument[];
  redaction_rules?: RedactionRule[];
  analyzed_doc_ids?: string[];
  draft_artifacts?: DraftArtifact[];
};

export type CaseSummary = {
  case_id: string;
  case_title: string;
  client_name: string;
  case_summary: string;
  charge_summary: string;
  next_deadline_date: string | null;
  next_deadline_title: string | null;
  contradiction_count: number;
  material_count: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical' | null;
  status: string;
  created_at: string;
  is_pending?: boolean;
};

export type TabId = 'timeline' | 'deadlines' | 'facts' | 'legal' | 'drafts' | 'questions' | 'brief';

export type ChatMsg = {
  role: 'user' | 'assistant';
  content: string;
  id: string;
};

export type ChatState = {
  open: boolean;
  messages: ChatMsg[];
  caseContext: string | null;
  activeCaseId: string | null;
};

export type UserProfile = {
  id: string;
  full_name: string | null;
  studio: string | null;
  phone: string | null;
};
