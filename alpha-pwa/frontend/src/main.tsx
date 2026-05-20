import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertTriangle, ArrowLeft, ArrowRight, BookOpen, BriefcaseBusiness,
  CalendarClock, CheckCircle2, CheckSquare, ChevronDown, ChevronRight,
  Clock, Copy, Eye, EyeOff, FileText, FolderPlus, Gavel, Loader2, LogOut, MapPin, MessageSquare, Mic, Plus, RefreshCw,
  Scale, Search, Send, Share2, ShieldAlert, ShieldCheck, ShieldOff, Sparkles,
  Square, Trash2, Upload, User, Users, X, Zap,
} from 'lucide-react';
import './styles.css';
import { dbSave, dbList, dbGet, dbDelete } from './db';
import { installMockApi } from './data/mockApi';
import { createClient, type Session } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  document.getElementById('root')!.innerHTML =
    '<div style="min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#0d1117;color:#f87171;font-family:system-ui;text-align:center;padding:24px"><div><strong>Configurazione mancante</strong><br><small style="color:#6b7280">VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY non impostati.<br>Aggiungi le variabili d\'ambiente e rideploya.</small></div></div>';
  throw new Error('Missing Supabase env vars');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const DEV_BYPASS_AUTH =
  import.meta.env.VITE_BYPASS_AUTH === 'true' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname);

if (import.meta.env.VITE_MOCK_DATA === 'true') installMockApi();

const API = import.meta.env.VITE_API_URL ?? '';

// ── Types ────────────────────────────────────────────────────────────────────

type SourceRef = {
  source_name: string; page: number | null; chunk: string | null;
  quote: string; confidence: number;
};
type Material = { id: string; name: string; kind: string; description: string; excerpt: string; content: string; };
type TimelineEvent = { date: string | null; time: string | null; title: string; description: string; source_refs: SourceRef[]; confidence: number; };
type Person = { name: string; role: string; notes: string; source_refs: SourceRef[]; };
type EvidenceItem = { title: string; status: string; notes: string; source_refs: SourceRef[]; };
type OpenQuestion = { question: string; why_it_matters: string; source_refs: SourceRef[]; };
type MissingDocument = { title: string; reason: string; priority: 'alta' | 'media' | 'bassa'; };
type Contradiction = { title: string; description: string; source_refs: SourceRef[]; };
type ProceduralDeadline = {
  title: string; deadline_type: 'hearing' | 'defense_brief' | 'filing' | 'investigation' | 'other';
  due_date: string; due_time: string | null; status: 'confirmed' | 'candidate' | 'needs_review';
  urgency: 'alta' | 'media' | 'bassa'; description: string;
  start_work_date: string | null; internal_target_date: string | null;
  source_refs: SourceRef[]; tasks: string[];
};
type UsageEstimate = { pages: number; audio_minutes: number; flash_input_tokens: number; flash_output_tokens: number; pro_used: boolean; model_route: string; };

type ChargeElement = { element: string; description: string; status: 'proven' | 'disputed' | 'weak' | 'missing'; notes: string; source_refs: SourceRef[]; };
type ChargeAnalysis = { charge_code: string; charge_name: string; max_sentence: string; elements_required: ChargeElement[]; available_defenses: string[]; prosecution_strength: number; notes: string; source_refs: SourceRef[]; };
type DefenseStrategy = { title: string; strategy_type: string; priority: 'primary' | 'secondary' | 'fallback'; description: string; strengths: string[]; risks: string[]; required_evidence: string[]; source_refs: SourceRef[]; };
type ConstitutionalIssue = { title: string; issue_type: string; severity: 'critical' | 'significant' | 'minor'; description: string; legal_basis: string; remedy: string; source_refs: SourceRef[]; };
type WitnessAssessment = { witness_name: string; role: 'prosecution' | 'defense' | 'neutral' | 'expert'; credibility_score: number; key_testimony: string; strengths: string[]; vulnerabilities: string[]; cross_examination_angles: string[]; source_refs: SourceRef[]; };
type EvidenceBalance = { prosecution_strength: number; defense_strength: number; key_prosecution_evidence: string[]; key_defense_evidence: string[]; critical_gaps: string[]; overall_assessment: string; };
type LegalAnalysis = {
  risk_level: 'low' | 'medium' | 'high' | 'critical'; risk_summary: string; immediate_actions: string[];
  charges: ChargeAnalysis[]; strategies: DefenseStrategy[]; constitutional_issues: ConstitutionalIssue[];
  witness_assessments: WitnessAssessment[]; evidence_balance: EvidenceBalance; client_summary: string;
};

type RawDocument = {
  doc_id: string; name: string; description: string; text: string; added_at: string;
};

type UploadQueueItem = {
  id: string;
  file: File;
  name: string;
  size: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  text?: string;
  error?: string;
  description?: string;
};

type RedactionRule = {
  id: string; original: string; replacement: string; enabled: boolean;
};

type CaseAnalysis = {
  case_id: string; case_title: string; language: string; case_summary: string;
  materials: Material[]; timeline: TimelineEvent[]; people: Person[];
  evidence: EvidenceItem[]; open_questions: OpenQuestion[]; missing_documents: MissingDocument[];
  contradictions: Contradiction[]; procedural_deadlines: ProceduralDeadline[];
  brief_markdown: string; usage_estimate: UsageEstimate; legal_analysis: LegalAnalysis | null;
  is_pending?: boolean; raw_documents?: RawDocument[]; redaction_rules?: RedactionRule[]; analyzed_doc_ids?: string[];
};

type CaseSummary = {
  case_id: string; case_title: string; client_name: string; case_summary: string;
  charge_summary: string; next_deadline_date: string | null; next_deadline_title: string | null;
  contradiction_count: number; material_count: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical' | null; status: string; created_at: string;
  is_pending?: boolean;
};

type TabId = 'timeline' | 'deadlines' | 'facts' | 'legal' | 'questions' | 'brief';

type ChatMsg = { role: 'user' | 'assistant'; content: string; id: string; };
type ChatState = { open: boolean; messages: ChatMsg[]; caseContext: string | null; activeCaseId: string | null; };

type UserProfile = { id: string; full_name: string | null; studio: string | null; phone: string | null; };

function buildCaseContext(c: CaseAnalysis): string {
  const la = c.legal_analysis;
  let ctx = `FASCICOLO: ${c.case_title}\n\nSINTESI: ${c.case_summary}\n\n`;

  if (c.people.length) {
    ctx += `PARTI:\n${c.people.map(p => `• ${p.name} (${p.role})${p.notes ? ': ' + p.notes : ''}`).join('\n')}\n\n`;
  }

  if (c.timeline.length) {
    ctx += `CRONOLOGIA:\n${c.timeline.map(e => `• [${e.date ?? '?'}${e.time ? ' ' + e.time : ''}] ${e.title}: ${e.description}`).join('\n')}\n\n`;
  }

  if (la) {
    ctx += `ACCUSE:\n${la.charges.map(ch => `• ${ch.charge_code} — ${ch.charge_name} (max: ${ch.max_sentence})`).join('\n')}\n\n`;
    ctx += `RISCHIO: ${la.risk_level.toUpperCase()} — ${la.risk_summary}\n\n`;
    if (la.strategies.length) {
      ctx += `STRATEGIE DIFENSIVE:\n${la.strategies.map(s => `• [${s.priority}] ${s.title}: ${s.description}`).join('\n')}\n\n`;
    }
    if (la.constitutional_issues.length > 0) {
      ctx += `QUESTIONI PROCEDURALI:\n${la.constitutional_issues.map(i => `• ${i.title} (${i.severity})\n  Base legale: ${i.legal_basis}\n  Rimedio: ${i.remedy}`).join('\n')}\n\n`;
    }
    if (la.witness_assessments.length) {
      ctx += `TESTIMONI:\n${la.witness_assessments.map(w => `• ${w.witness_name} (${w.role}, credibilità ${Math.round(w.credibility_score * 100)}%): ${w.key_testimony}`).join('\n')}\n\n`;
    }
    if (la.evidence_balance) {
      ctx += `BILANCIAMENTO PROVE:\n  Accusa: ${Math.round(la.evidence_balance.prosecution_strength * 100)}% — ${la.evidence_balance.key_prosecution_evidence.join('; ')}\n  Difesa: ${Math.round(la.evidence_balance.defense_strength * 100)}% — ${la.evidence_balance.key_defense_evidence.join('; ')}\n  Lacune critiche: ${la.evidence_balance.critical_gaps.join('; ')}\n\n`;
    }
  }

  if (c.contradictions.length) {
    ctx += `CONTRADDIZIONI:\n${c.contradictions.map(ct => `• ${ct.title}: ${ct.description}`).join('\n')}\n\n`;
  }

  if (c.open_questions.length) {
    ctx += `DOMANDE APERTE:\n${c.open_questions.map(q => `• ${q.question} — perché conta: ${q.why_it_matters}`).join('\n')}\n\n`;
  }

  const urgentDeadlines = c.procedural_deadlines.filter(d => d.urgency === 'alta');
  if (urgentDeadlines.length) {
    ctx += `SCADENZE URGENTI:\n${urgentDeadlines.map(d => `• ${d.due_date}${d.due_time ? ' ' + d.due_time : ''} — ${d.title} (${d.deadline_type}): ${d.description}`).join('\n')}\n\n`;
  }

  if (c.brief_markdown?.trim()) {
    ctx += `PROMEMORIA DIFENSIVO CORRENTE:\n${c.brief_markdown.trim()}\n\n`;
  }

  return ctx.trim();
}

function caseAnalysisToSummary(c: CaseAnalysis): CaseSummary {
  if (c.is_pending) {
    const n = c.raw_documents?.length ?? 0;
    return {
      case_id: c.case_id, case_title: c.case_title, client_name: '—',
      case_summary: n === 0 ? 'Fascicolo vuoto — aggiungi documenti' : `${n} documento${n !== 1 ? 'i' : ''} caricato${n !== 1 ? 'i' : ''}, analisi non avviata`,
      charge_summary: '— da analizzare —', next_deadline_date: null, next_deadline_title: null,
      contradiction_count: 0, material_count: n, risk_level: null, status: 'pending',
      created_at: new Date().toISOString(), is_pending: true,
    };
  }
  const la = c.legal_analysis;
  const nextDeadline = [...c.procedural_deadlines].sort((a, b) =>
    `${a.due_date}T${a.due_time ?? '23:59'}`.localeCompare(`${b.due_date}T${b.due_time ?? '23:59'}`)
  )[0];
  const client = c.people.find(p => /imputat|accusat|defendant|client/i.test(p.role));
  return {
    case_id: c.case_id, case_title: c.case_title, client_name: client?.name ?? '—',
    case_summary: c.case_summary,
    charge_summary: la?.charges.map(ch => ch.charge_name).join(', ') || 'Accuse da determinare',
    next_deadline_date: nextDeadline?.due_date ?? null, next_deadline_title: nextDeadline?.title ?? null,
    contradiction_count: c.contradictions.length, material_count: c.materials.length,
    risk_level: la?.risk_level ?? null, status: 'active', created_at: new Date().toISOString(),
  };
}

const DOC_PROMPTS: Record<string, (ctx: string) => string> = {
  memoria: ctx => `${ctx}\n\n---\nRedigi una memoria difensiva completa per questo caso. Struttura l'atto secondo il formato italiano standard:\n\n**INTESTAZIONE** (Tribunale competente, numero procedimento, imputato, difensore)\n**IN FATTO** — narrazione precisa dei fatti rilevanti per la difesa\n**IN DIRITTO** — motivi giuridici articolati, con:\n  - Citazioni normative specifiche (art. X c.p. / art. X c.p.p.)\n  - Precedenti della Cassazione Penale (sezione, numero, anno)\n  - Interpretazioni dottrinali rilevanti\n**CONCLUSIONI** — richieste formali al giudice\n\nScrivi in italiano giuridico formale. Sii specifico e approfondito, non generico.`,

  cassazione: ctx => `${ctx}\n\n---\nPredisponi un ricorso per Cassazione avverso eventuale sentenza di condanna. Sviluppa i motivi di ricorso ex art. 606 c.p.p. più solidi per questo caso. Per ogni motivo:\n\n**MOTIVO N. X — [tipo ex lett. a/b/c/d/e art. 606 c.p.p.]**\n  - Formulazione tecnica del motivo\n  - Norma o principio violato\n  - Argomentazione sviluppata\n  - Precedenti della Cassazione favorevoli (cita sezione e numero)\n\nConcentrati sui vizi di legittimità più fondati: violazione di legge (lett. b), vizio di motivazione (lett. e), inutilizzabilità prove (lett. c).`,

  eccezione: ctx => `${ctx}\n\n---\nRedigi un'eccezione procedurale formale da depositare in udienza, focalizzata sul vizio processuale più solido del fascicolo. Struttura:\n\n**TITOLO ECCEZIONE**\n**NORMA VIOLATA** (articolo preciso del c.p.p. o legge speciale)\n**IN FATTO** — descrizione della violazione procedurale concreta\n**IN DIRITTO** — argomentazione giuridica con:\n  - Interpretazione della norma violata\n  - Conseguenza processuale (nullità / inutilizzabilità / inammissibilità)\n  - Giurisprudenza della Cassazione che supporta l'eccezione\n**RICHIESTA** — provvedimento chiesto al giudice\n\nSii preciso: indica se si tratta di nullità assoluta, relativa, o inutilizzabilità patologica/fisiologica.`,

  crossExam: ctx => `${ctx}\n\n---\nPreparazione per il controesame dei testimoni dell'accusa. Per ciascun testimone nel fascicolo, sviluppa:\n\n**[NOME TESTIMONE — ruolo]**\nCredibilità: [score]\n\n*Obiettivo del controesame*: [minare la credibilità / estrarre ammissioni favorevoli / limitare il danno]\n\n*Sequenza di domande*:\n1. [domanda di apertura — fatto non contestabile]\n2-5. [sviluppo logico verso la contraddizione o l'ammissione]\nX. [domanda finale incisiva]\n\n*Trappole da evitare*:\n*Documenti da usare come confronto*:\n\nUsa la tecnica del controesame a domande chiuse (sì/no).`,

  strategy: ctx => `${ctx}\n\n---\nAnalisi strategica approfondita del caso. Valuta ogni linea difensiva con occhio critico da avvocato esperto:\n\nPer ogni strategia:\n- **Probabilità di successo** (realistica, non ottimistica)\n- **Prove necessarie ancora da acquisire**\n- **Rischi e controindicazioni**\n- **Giurisprudenza favorevole** (Cass. pen., sezione, numero)\n- **Tempistica tattica** — quando e come giocare questa carta\n\nConcludi con una **raccomandazione tattica generale**: quale combinazione di strategie adottare, in quale ordine, e quale eventuale piano B prepararsi.`,

  clienteNote: ctx => `${ctx}\n\n---\nIl cliente vuole capire la sua situazione. Prepara una spiegazione in linguaggio semplice e chiaro — senza tecnicismi legali — che risponda a queste domande:\n\n1. **Di cosa è accusato, in parole semplici?**\n2. **Quali sono i rischi concreti (pena, misure cautelari)?**\n3. **Cosa stiamo facendo per difenderlo?**\n4. **Cosa deve fare lui nei prossimi giorni?**\n5. **Cosa NON deve assolutamente fare o dire?**\n\nTono: diretto, rassicurante ma onesto. Evita ogni burocratese. Il cliente deve uscire dal colloquio capendo la situazione senza farsi prendere dal panico.`,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function pct(v: number) { return `${Math.round(v * 100)}%`; }
function formatDate(v: string | null) {
  if (!v) return 'da definire';
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${v}T12:00:00`));
}
function formatShortDate(v: string | null) {
  if (!v) return '—';
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short' }).format(new Date(`${v}T12:00:00`));
}
function formatDateFull(v: string | null) {
  if (!v) return 'da definire';
  const d = new Date(`${v}T12:00:00`);
  const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  return `${days[d.getDay()]} ${new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)}`;
}

function deadlineTypeLabel(t: ProceduralDeadline['deadline_type']) {
  return ({ hearing: 'udienza', defense_brief: 'memoria difensiva', filing: 'deposito', investigation: 'indagine difensiva', other: 'altro' })[t];
}

function riskColor(level: string | null) {
  return ({ critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' })[level ?? ''] ?? '#94a3b8';
}

function riskLabel(level: string | null) {
  return ({ critical: 'Critico', high: 'Alto', medium: 'Medio', low: 'Basso' })[level ?? ''] ?? '—';
}

function riskIcon(level: string | null) {
  if (level === 'critical' || level === 'high') return <ShieldOff size={16} />;
  if (level === 'medium') return <ShieldAlert size={16} />;
  return <ShieldCheck size={16} />;
}

function elementStatusColor(s: ChargeElement['status']) {
  return ({ proven: '#ef4444', disputed: '#f97316', weak: '#eab308', missing: '#22c55e' })[s];
}
function elementStatusLabel(s: ChargeElement['status']) {
  return ({ proven: 'provato', disputed: 'contestato', weak: 'debole', missing: 'mancante' })[s];
}

function witnessRoleLabel(r: WitnessAssessment['role']) {
  return ({ prosecution: 'accusa', defense: 'difesa', neutral: 'neutro', expert: 'esperto' })[r];
}

function strategyTypeLabel(t: string) {
  return ({
    alibi: 'Alibi', misidentification: 'Misidentificazione', lack_of_intent: 'Assenza dolo',
    procedural: 'Procedurale', constitutional: 'Costituzionale', affirmative: 'Esimente', negotiation: 'Negoziazione',
  })[t] ?? t;
}

function issueTypeLabel(t: string) {
  return ({
    illegal_search: 'Perquisizione illegittima', coerced_confession: 'Confessione forzata',
    right_to_counsel: 'Diritto alla difesa', due_process: 'Giusto processo',
    speedy_trial: 'Durata ragionevole', procedural_violation: 'Violazione procedurale',
    evidence_tampering: 'Alterazione prove',
  })[t] ?? t;
}

function markdownToLines(md: string) { return md.split('\n').filter(l => l.trim()); }

function buildUserContextMaterial(c: CaseAnalysis): { name: string; kind: string; text: string } | null {
  const isIncremental = c.legal_analysis != null && (c.analyzed_doc_ids?.length ?? 0) > 0;
  const lines: string[] = [];
  if (c.case_summary?.trim()) lines.push(`SINTESI: ${c.case_summary.trim()}`);
  if (c.people.length) lines.push('PERSONE:\n' + c.people.map(p => `- ${p.name} (${p.role})${p.notes ? ': ' + p.notes : ''}`).join('\n'));
  if (c.timeline.length) lines.push('TIMELINE:\n' + c.timeline.map(e => `- [${e.date ?? '?'}${e.time ? ' ' + e.time : ''}] ${e.title}${e.description ? ': ' + e.description : ''}`).join('\n'));
  if (c.evidence.length) lines.push('PROVE:\n' + c.evidence.map(e => `- ${e.title} (${e.status})${e.notes ? ': ' + e.notes : ''}`).join('\n'));
  if (c.contradictions.length) lines.push('CONTRADDIZIONI:\n' + c.contradictions.map(ct => `- ${ct.title}: ${ct.description}`).join('\n'));
  if (c.open_questions.length) lines.push('DOMANDE APERTE:\n' + c.open_questions.map(q => `- ${q.question} (${q.why_it_matters})`).join('\n'));
  if (c.missing_documents.length) lines.push('DOCUMENTI MANCANTI:\n' + c.missing_documents.map(d => `- ${d.title} (priorità ${d.priority}): ${d.reason}`).join('\n'));
  if (c.procedural_deadlines.length) lines.push('SCADENZE:\n' + c.procedural_deadlines.map(dl => `- [${dl.due_date}] ${dl.title} (urgenza ${dl.urgency})`).join('\n'));
  if (c.brief_markdown?.trim()) lines.push(`BOZZA PROMEMORIA DIFENSIVO (aggiorna e migliora con i nuovi documenti):\n${c.brief_markdown.trim()}`);
  if (!lines.length) return null;
  let text = lines.join('\n\n');
  const MAX_CONTEXT_CHARS = 8000;
  if (text.length > MAX_CONTEXT_CHARS) {
    text = text.slice(0, MAX_CONTEXT_CHARS) + '\n\n[...contesto troncato per limite di lunghezza — i nuovi documenti sono prioritari...]';
  }
  return {
    name: isIncremental
      ? 'Analisi esistente consolidata — integra i nuovi documenti che seguono, aggiorna il brief_markdown.'
      : 'Annotazioni esistenti (inserite dall\'avvocato — integrare, non sovrascrivere)',
    kind: 'text',
    text,
  };
}

function mergeArrays<T extends Record<string, unknown>>(existing: T[], ai: T[], key: keyof T): T[] {
  const seen = new Set(existing.map(e => String(e[key] ?? '').toLowerCase().trim()));
  const novel = ai.filter(a => !seen.has(String(a[key] ?? '').toLowerCase().trim()));
  return [...existing, ...novel];
}

function mergeWithAi(existing: CaseAnalysis, ai: CaseAnalysis): CaseAnalysis {
  const merged: CaseAnalysis = {
    ...ai,
    case_id: existing.case_id,
    raw_documents: existing.raw_documents,
    analyzed_doc_ids: existing.analyzed_doc_ids,
    is_pending: false,
    case_title: existing.case_title?.trim() || ai.case_title,
    case_summary: existing.case_summary?.trim() || ai.case_summary,
    brief_markdown: ai.brief_markdown?.trim() || existing.brief_markdown || '',
    timeline: mergeArrays(existing.timeline, ai.timeline, 'title'),
    people: mergeArrays(existing.people, ai.people, 'name'),
    evidence: mergeArrays(existing.evidence, ai.evidence, 'title'),
    open_questions: mergeArrays(existing.open_questions, ai.open_questions, 'question'),
    missing_documents: mergeArrays(existing.missing_documents, ai.missing_documents, 'title'),
    contradictions: mergeArrays(existing.contradictions, ai.contradictions, 'title'),
    procedural_deadlines: mergeArrays(existing.procedural_deadlines, ai.procedural_deadlines, 'title'),
    materials: mergeArrays(existing.materials, ai.materials, 'name'),
  };
  if (existing.legal_analysis && ai.legal_analysis) {
    merged.legal_analysis = {
      ...ai.legal_analysis,
      risk_level: existing.legal_analysis.risk_level,
      risk_summary: existing.legal_analysis.risk_summary?.trim() || ai.legal_analysis.risk_summary,
      immediate_actions: existing.legal_analysis.immediate_actions.length
        ? existing.legal_analysis.immediate_actions
        : ai.legal_analysis.immediate_actions,
    };
  }
  return merged;
}

// ── Redaction helpers ─────────────────────────────────────────────────────────

function redactString(text: string, rules: RedactionRule[]): string {
  return rules.reduce((t, r) => {
    if (!r.enabled || !r.original.trim()) return t;
    const escaped = r.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return t.replace(new RegExp(escaped, 'gi'), r.replacement);
  }, text);
}

function redactObj<T>(obj: T, rules: RedactionRule[]): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return redactString(obj, rules) as unknown as T;
  if (Array.isArray(obj)) return (obj as unknown[]).map(item => redactObj(item, rules)) as unknown as T;
  if (typeof obj === 'object') {
    const result = {} as T;
    for (const key of Object.keys(obj as object) as (keyof T)[]) {
      (result as Record<string, unknown>)[key as string] = redactObj((obj as Record<string, unknown>)[key as string], rules);
    }
    return result;
  }
  return obj;
}

function applyRedactionToCase(c: CaseAnalysis, rules: RedactionRule[]): CaseAnalysis {
  const active = rules.filter(r => r.enabled && r.original.trim());
  if (!active.length) return c;
  return redactObj(c, active);
}

function mergeRedactionRules(global: RedactionRule[], perCase: RedactionRule[]): RedactionRule[] {
  const seen = new Set(global.map(r => r.id));
  return [...global, ...perCase.filter(r => !seen.has(r.id))];
}

const REDACT_DETECT_PROMPT = (caseCtx: string) =>
  `${caseCtx}\n\n---\nSei un assistente per la privacy legale. Analizza il fascicolo sopra e identifica TUTTI i dati personali che potrebbero identificare le parti private.

CATEGORIE DA RILEVARE:
- Nomi propri di persone fisiche (imputati, vittime, testimoni, familiari) — incluse varianti cognome-solo o iniziali
- Indirizzi specifici (via, numero civico, città, CAP)
- Numeri di telefono, email, username
- Codici fiscali, numeri di carta d'identità/passaporto
- Targhe veicoli, numeri di conto/IBAN
- Numeri di procedimento/fascicolo penale
- Nomi di aziende private o studi legali delle parti
- Luoghi molto specifici che identificano le parti (es. abitazione, posto di lavoro)

NON REDARRE:
- Nomi di magistrati, PM, GIP/GUP (sono pubblici ufficiali nell'esercizio delle funzioni)
- Nomi di enti pubblici (Tribunale, Procura, Questura, CC)
- Riferimenti normativi (art. 624 c.p., leggi, decreti)
- Date di udienza o scadenze processuali (non identificano persone)
- Termini giuridici generici

REGOLE DI OUTPUT:
- Ogni persona riceve un token progressivo coerente: NOME_1, NOME_2, … (persona diversa = numero diverso)
- Se lo stesso soggetto appare in più varianti (es. "Mario Rossi", "Rossi", "M. Rossi"), elencale TUTTE mappate allo stesso token
- Formato ESATTO per ogni riga: ORIGINALE → SOSTITUZIONE
- Nessuna riga vuota, nessun commento, nessun prefisso
- Se non trovi dati sensibili, scrivi solo: NESSUN_DATO_SENSIBILE

Esempio output corretto:
Mario Rossi → [NOME_1]
Rossi → [NOME_1]
Via Tiburtina 42, Roma → [INDIRIZZO_1]
333-4521789 → [TELEFONO_1]
Giuseppe Conti → [NOME_2]`;

const REDACT_APPLY_PROMPT = (text: string) =>
  `Anonimizza il seguente testo giuridico italiano. Regole:\n- Nomi propri di persone → [NOME_N] (progressivo per persona, coerente)\n- Indirizzi specifici → [INDIRIZZO]\n- Date specifiche identificative → [DATA]\n- Numeri procedimento → [N.PROC.]\n- Dati di contatto → [CONTATTO]\nRestituisci SOLO il testo anonimizzato, senza spiegazioni né prefissi.\n\nTESTO:\n${text}`;

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'success') => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, type });
    timerRef.current = setTimeout(() => setToast(null), 2800);
  }, []);
  return { toast, showToast, dismissToast: () => setToast(null) };
}

function useCompletedTasks(caseId: string) {
  const [completed, setCompleted] = useState<Set<string>>(() => {
    try { return new Set<string>(JSON.parse(localStorage.getItem('plt_tasks') ?? '[]')); }
    catch { return new Set<string>(); }
  });
  const key = (dlTitle: string, idx: number) => `${caseId}|${dlTitle}|${idx}`;
  const toggle = useCallback((dlTitle: string, idx: number) => {
    setCompleted(prev => {
      const next = new Set(prev);
      const k = `${caseId}|${dlTitle}|${idx}`;
      if (next.has(k)) next.delete(k); else next.add(k);
      try { localStorage.setItem('plt_tasks', JSON.stringify([...next])); } catch {}
      return next;
    });
  }, [caseId]);
  const isDone = useCallback((dlTitle: string, idx: number) => completed.has(key(dlTitle, idx)), [completed, caseId]);
  const doneCount = useCallback((dlTitle: string, total: number) => {
    let n = 0; for (let i = 0; i < total; i++) if (completed.has(key(dlTitle, i))) n++;
    return n;
  }, [completed, caseId]);
  return { toggle, isDone, doneCount };
}

function useRedactionRules() {
  const [globalRules, setGlobalRulesState] = useState<RedactionRule[]>(() => {
    try { return JSON.parse(localStorage.getItem('plt_redaction_rules') ?? '[]'); }
    catch { return []; }
  });
  const setGlobalRules = useCallback((rules: RedactionRule[]) => {
    setGlobalRulesState(rules);
    try { localStorage.setItem('plt_redaction_rules', JSON.stringify(rules)); } catch {}
  }, []);
  return { globalRules, setGlobalRules };
}

// ── Small components ─────────────────────────────────────────────────────────

function ToastNotification({ message, type, onDismiss }: { message: string; type: 'success' | 'info' | 'error'; onDismiss: () => void }) {
  return (
    <div className={`toast toast-${type}`} onClick={onDismiss}>
      {type === 'success' ? <CheckCircle2 size={15} /> : type === 'error' ? <AlertTriangle size={15} /> : <Sparkles size={15} />}
      <span>{message}</span>
    </div>
  );
}

function SourceBadge({ refItem, onSelect }: { refItem: SourceRef; onSelect: (s: SourceRef) => void }) {
  return (
    <button className="source-badge" onClick={() => onSelect(refItem)}>
      <FileText size={12} /> {refItem.source_name} · {pct(refItem.confidence)}
    </button>
  );
}

function SourceRow({ refs, onSelect }: { refs: SourceRef[]; onSelect: (s: SourceRef) => void }) {
  if (!refs?.length) return null;
  return <div className="source-row">{refs.map(r => <SourceBadge key={r.quote + r.source_name} refItem={r} onSelect={onSelect} />)}</div>;
}

function StrengthBar({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="strength-bar-wrap">
      <div className="strength-bar-labels">
        <span>{label}</span><span>{pct(value)}</span>
      </div>
      <div className="strength-bar-track">
        <div className="strength-bar-fill" style={{ width: `${value * 100}%`, background: color }} />
      </div>
    </div>
  );
}

function Editable({ value, onChange, placeholder, multiline, className, readOnly }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => {
    if (!editing) return;
    const el = multiline ? textareaRef.current : inputRef.current;
    el?.focus();
    if (el instanceof HTMLInputElement) el.select();
  }, [editing, multiline]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next !== value) onChange(next);
  };
  const cancel = () => { setDraft(value); setEditing(false); };

  if (editing) {
    if (multiline) {
      return (
        <textarea
          ref={textareaRef}
          className={`editable-input editable-input-multi ${className ?? ''}`}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Escape') cancel();
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit();
          }}
          rows={Math.max(2, Math.min(10, draft.split('\n').length + 1))}
          placeholder={placeholder}
        />
      );
    }
    return (
      <input
        ref={inputRef}
        className={`editable-input ${className ?? ''}`}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') cancel();
        }}
        placeholder={placeholder}
      />
    );
  }

  const display = value || (placeholder ?? 'Tocca per scrivere…');
  if (readOnly) {
    return <span className={`editable ${className ?? ''}`}>{display}</span>;
  }
  return (
    <span
      className={`editable${value ? '' : ' editable-empty'} ${className ?? ''}`}
      onClick={() => setEditing(true)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditing(true); } }}
      title="Tocca per modificare"
    >
      {display}
    </span>
  );
}

function RowDelete({ onClick, label }: { onClick: () => void; label?: string }) {
  return (
    <button
      className="row-delete-btn"
      onClick={e => { e.stopPropagation(); if (confirm(label ? `Eliminare "${label}"?` : 'Eliminare questa voce?')) onClick(); }}
      title="Elimina voce"
    >
      <Trash2 size={13} />
    </button>
  );
}

function AddRowButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="add-row-btn" onClick={onClick}>
      <Plus size={14} /> {label}
    </button>
  );
}

function EditableSelect<T extends string>({ value, options, onChange, className }: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <select
      className={`editable-select ${className ?? ''}`}
      value={value}
      onChange={e => onChange(e.target.value as T)}
      onClick={e => e.stopPropagation()}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function EditablePercent({ value, onChange, className }: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(Math.round(value * 100)));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setDraft(String(Math.round(value * 100))); }, [value]);
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select(); } }, [editing]);

  const commit = () => {
    setEditing(false);
    const n = Math.max(0, Math.min(100, Number(draft) || 0));
    const asFloat = n / 100;
    if (Math.abs(asFloat - value) > 0.001) onChange(asFloat);
    setDraft(String(n));
  };

  if (editing) {
    return (
      <input
        ref={ref}
        type="number"
        min={0}
        max={100}
        step={1}
        className={`editable-input editable-percent-input ${className ?? ''}`}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(String(Math.round(value * 100))); setEditing(false); } }}
      />
    );
  }
  return (
    <span
      className={`editable ${className ?? ''}`}
      onClick={e => { e.stopPropagation(); setEditing(true); }}
      role="button"
      tabIndex={0}
      title="Tocca per modificare"
    >
      {Math.round(value * 100)}%
    </span>
  );
}

function EditableStringList({ items, onChange, placeholder, itemClass, addLabel, icon }: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  itemClass?: string;
  addLabel: string;
  icon?: React.ReactNode;
}) {
  return (
    <>
      <ul className="editable-string-list">
        {items.length === 0 && <li className="muted">Nessuna voce.</li>}
        {items.map((item, i) => (
          <li key={i} className={itemClass}>
            {icon}
            <span style={{ flex: 1 }}>
              <Editable
                value={item}
                onChange={v => onChange(items.map((x, idx) => idx === i ? v : x))}
                placeholder={placeholder}
                multiline
              />
            </span>
            <RowDelete onClick={() => onChange(items.filter((_, idx) => idx !== i))} />
          </li>
        ))}
      </ul>
      <AddRowButton label={addLabel} onClick={() => onChange([...items, ''])} />
    </>
  );
}

// ── Drawers ──────────────────────────────────────────────────────────────────

function SourceDrawer({ source, onClose }: { source: SourceRef | null; onClose: () => void }) {
  if (!source) return null;
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="source-drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-handle" />
        <div className="drawer-header">
          <div><p className="eyebrow">Fonte collegata</p><h2>{source.source_name}</h2></div>
          <button onClick={onClose} className="ghost-button">Chiudi</button>
        </div>
        <blockquote>&ldquo;{source.quote}&rdquo;</blockquote>
        <div className="drawer-meta">
          <span>Pagina {source.page ?? 1}</span>
          <span>Chunk {source.chunk ?? 'demo'}</span>
          <span>Confidenza {pct(source.confidence)}</span>
        </div>
      </aside>
    </div>
  );
}

function MaterialDrawer({ material, onClose }: { material: Material | null; onClose: () => void }) {
  if (!material) return null;
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="source-drawer material-drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-handle" />
        <div className="drawer-header">
          <div><p className="eyebrow">Documento</p><h2>{material.name}</h2></div>
          <button onClick={onClose} className="ghost-button">Chiudi</button>
        </div>
        <div className="material-content">
          {material.content
            ? material.content.split('\n').map((l, i) => <p key={i}>{l || ' '}</p>)
            : <p className="muted">Contenuto non disponibile per {material.kind.toUpperCase()}.</p>}
        </div>
      </aside>
    </div>
  );
}

function RawDocDrawer({ doc, onClose, onDelete }: { doc: RawDocument | null; onClose: () => void; onDelete: (id: string) => void }) {
  if (!doc) return null;
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="source-drawer material-drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-handle" />
        <div className="drawer-header">
          <div><p className="eyebrow">{doc.name}</p><h2>{doc.description || doc.name}</h2></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { onDelete(doc.doc_id); onClose(); }} className="ghost-button" style={{ color: '#ef4444' }}><Trash2 size={16} /></button>
            <button onClick={onClose} className="ghost-button">Chiudi</button>
          </div>
        </div>
        <div className="material-content">
          {doc.text
            ? doc.text.split('\n').map((l, i) => <p key={i}>{l || ' '}</p>)
            : <p className="muted">Nessun testo disponibile.</p>}
        </div>
      </aside>
    </div>
  );
}

function NewCaseDrawer({ onClose, onCreate }: { onClose: () => void; onCreate: (title: string) => void }) {
  const [title, setTitle] = useState('');
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="source-drawer upload-drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-handle" />
        <div className="drawer-header">
          <div><p className="eyebrow">Fascicolo</p><h2>Nuovo fascicolo</h2></div>
          <button onClick={onClose} className="ghost-button"><X size={18} /></button>
        </div>
        <div className="upload-field">
          <label>Titolo del caso</label>
          <input
            className="upload-input"
            placeholder="es. Caso Rossi — Furto aggravato"
            value={title}
            autoFocus
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && title.trim()) onCreate(title.trim()); }}
          />
        </div>
        <div className="upload-actions">
          <button className="ghost-button" onClick={onClose}>Annulla</button>
          <button className="primary-button" disabled={!title.trim()} onClick={() => title.trim() && onCreate(title.trim())}>
            <FolderPlus size={15} /> Crea fascicolo
          </button>
        </div>
      </aside>
    </div>
  );
}

function MultiFileUploadDrawer({
  queue,
  onClose,
  onAddFiles,
  onStartProcessing,
  onSaveAll,
  onRemoveItem,
  onRetryItem,
  onAddTextItem,
  processing,
}: {
  queue: UploadQueueItem[];
  onClose: () => void;
  onAddFiles: (files: File[]) => void;
  onStartProcessing: () => void;
  onSaveAll: () => void;
  onRemoveItem: (id: string) => void;
  onRetryItem: (id: string) => void;
  onAddTextItem: (text: string, name?: string) => void;
  processing: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setTranscribing(true);
        try {
          const fd = new FormData();
          fd.append('file', blob, 'nota_vocale.webm');
          const res = await fetch(`${API}/api/transcribe`, { method: 'POST', body: fd });
          const data = await res.json();
          if (data.text) onAddTextItem(data.text, 'Nota vocale');
        } finally {
          setTranscribing(false);
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      alert('Microfono non disponibile o accesso negato.');
    }
  }, [onAddTextItem]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onAddFiles(files);
  }, [onAddFiles]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) onAddFiles(files);
    e.target.value = '';
  }, [onAddFiles]);

  const pendingCount = queue.filter(i => i.status === 'pending' || i.status === 'uploading').length;
  const doneCount = queue.filter(i => i.status === 'done' && i.text).length;
  const errorCount = queue.filter(i => i.status === 'error').length;
  const hasPending = queue.some(i => i.status === 'pending');

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="source-drawer upload-drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-handle" />
        <div className="drawer-header">
          <div>
            <p className="eyebrow">Elaborazione locale</p>
            <h2>Aggiungi documenti</h2>
          </div>
          <button onClick={onClose} className="ghost-button"><X size={18} /></button>
        </div>

        {/* Drop zone (multi-file) */}
        <label
          className={`drop-zone${dragging ? ' dragging' : ''}`}
          style={{ cursor: 'pointer' }}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <Upload size={28} />
          <p>Trascina i file qui o tocca per selezionarli</p>
          <small>PDF, DOCX, TXT, immagini — più file alla volta</small>
          <input ref={fileRef} type="file" style={{ display: 'none' }} multiple onChange={onFileChange} />
        </label>

        {/* Queue */}
        {queue.length > 0 && (
          <div className="upload-queue">
            {queue.map(item => (
              <div key={item.id} className="upload-queue-item">
                <div className="upload-queue-icon"><FileText size={18} /></div>
                <div className="upload-queue-info">
                  <div className="upload-queue-name">{item.description || item.name}</div>
                  <div className="upload-queue-size">
                    {item.name}
                    {item.size > 0 && ` · ${(item.size / 1024).toFixed(0)} KB`}
                  </div>
                </div>
                <div className={`upload-queue-status ${item.status}`}>
                  {item.status === 'pending' && <span style={{ color: '#94a3b8' }}>In attesa</span>}
                  {item.status === 'uploading' && <><Loader2 size={14} className="spin" /><span>Estrazione…</span></>}
                  {item.status === 'done' && <><CheckCircle2 size={16} style={{ color: '#4ade80' }} /></>}
                  {item.status === 'error' && (
                    <span style={{ color: '#f87171', cursor: 'pointer' }} onClick={() => onRetryItem(item.id)} title={item.error}>
                      <AlertTriangle size={14} /> Riprova
                    </span>
                  )}
                </div>
                {(item.status === 'pending' || item.status === 'done') && (
                  <button className="upload-queue-action" onClick={() => onRemoveItem(item.id)} title="Rimuovi">
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Voice + Paste section */}
        <div className="upload-field">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <label style={{ margin: 0 }}>Incolla testo o registra nota vocale</label>
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              disabled={transcribing}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: 12,
                background: recording ? 'rgba(239,68,68,0.15)' : 'rgba(148,163,184,0.12)',
                color: recording ? '#f87171' : '#94a3b8',
                transition: 'all .15s',
              }}
            >
              {transcribing
                ? <><Loader2 size={13} className="spin" /> Trascrivo…</>
                : recording
                  ? <><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1s infinite' }} /> Stop</>
                  : <><Mic size={13} /> Nota vocale</>
              }
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <textarea
              className="upload-textarea"
              placeholder="Incolla qui il testo del documento o registra una nota vocale…"
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              rows={3}
              style={{ flex: 1, minHeight: 80 }}
            />
            <button
              className="primary-button"
              disabled={!pasteText.trim()}
              onClick={() => { onAddTextItem(pasteText.trim()); setPasteText(''); }}
              style={{ alignSelf: 'flex-end', whiteSpace: 'nowrap', padding: '10px 14px', fontSize: '0.78rem' }}
            >
              Aggiungi testo
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0 2px', color: '#475569', fontSize: '0.74rem' }}>
          <ShieldCheck size={12} style={{ flexShrink: 0, color: '#22c55e' }} />
          I file originali restano sul tuo dispositivo. Solo il testo estratto viene inviato all'AI per l'analisi.
        </div>

        <div className="upload-actions">
          <button className="ghost-button" onClick={onClose}>Annulla</button>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {errorCount > 0 && <span style={{ fontSize: '0.75rem', color: '#f87171' }}>{errorCount} errore{errorCount > 1 ? 'i' : ''}</span>}
            {hasPending && !processing && (
              <button className="secondary-button" onClick={onStartProcessing}>
                <Zap size={14} /> Elabora {pendingCount > 0 ? `(${pendingCount})` : ''}
              </button>
            )}
            {processing && (
              <button className="secondary-button" disabled>
                <Loader2 size={14} className="spin" /> Elaborazione…
              </button>
            )}
            <button className="primary-button" disabled={doneCount === 0} onClick={onSaveAll}>
              <Plus size={15} /> Salva {doneCount > 0 ? `(${doneCount})` : ''}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

// ── Aula Mode overlay ─────────────────────────────────────────────────────────

const AULA_SLIDES = 5;

function AulaModeOverlay({ caseData, onClose }: { caseData: CaseAnalysis; onClose: () => void }) {
  const [slide, setSlide] = useState(0);
  const [time, setTime] = useState(() => new Date());
  const touchStartX = useRef(0);
  const la = caseData.legal_analysis;

  const nextDeadline = useMemo(() =>
    [...caseData.procedural_deadlines].sort((a, b) =>
      `${a.due_date}T${a.due_time ?? '23:59'}`.localeCompare(`${b.due_date}T${b.due_time ?? '23:59'}`)
    )[0],
    [caseData]
  );
  const primaryStrategy = la?.strategies.find(s => s.priority === 'primary') ?? la?.strategies[0];

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setSlide(s => Math.min(s + 1, AULA_SLIDES - 1));
      else if (e.key === 'ArrowLeft') setSlide(s => Math.max(s - 1, 0));
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(dx) > 44) setSlide(s => dx > 0 ? Math.min(s + 1, AULA_SLIDES - 1) : Math.max(s - 1, 0));
  };

  return (
    <div className="aula-overlay" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="aula-header">
        <div className="aula-brand"><Gavel size={13} /> AULA MODE</div>
        <div className="aula-clock"><Clock size={12} /> {time.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
        <button className="aula-close" onClick={onClose}><X size={19} /></button>
      </div>

      <div className="aula-dots">
        {Array.from({ length: AULA_SLIDES }, (_, i) => (
          <button key={i} className={`aula-dot${slide === i ? ' active' : ''}`} onClick={() => setSlide(i)} />
        ))}
      </div>

      <div className="aula-content">
        {slide === 0 && (
          <div className="aula-slide">
            <div className="aula-slide-label">01 — Il caso</div>
            <h2 className="aula-case-title">{caseData.case_title}</h2>
            {nextDeadline && (
              <div className="aula-hearing-box">
                <div className="aula-hearing-label">Prossima udienza / scadenza</div>
                <div className="aula-hearing-date">{formatDateFull(nextDeadline.due_date)}{nextDeadline.due_time ? ` · ${nextDeadline.due_time}` : ''}</div>
                <div className="aula-hearing-desc">{nextDeadline.title}</div>
              </div>
            )}
            {la && (
              <div className="aula-risk-box" style={{ borderColor: riskColor(la.risk_level) + '88', background: riskColor(la.risk_level) + '18' }}>
                {riskIcon(la.risk_level)} <span style={{ color: riskColor(la.risk_level), fontWeight: 800 }}>Rischio {riskLabel(la.risk_level)}</span>
              </div>
            )}
          </div>
        )}

        {slide === 1 && (
          <div className="aula-slide">
            <div className="aula-slide-label">02 — Strategia principale</div>
            {primaryStrategy ? (
              <>
                <h3 className="aula-strategy-title">{primaryStrategy.title}</h3>
                <ul className="aula-points">
                  {primaryStrategy.strengths.slice(0, 3).map((s, i) => (
                    <li key={i}><span className="aula-num">{i + 1}</span><span>{s}</span></li>
                  ))}
                </ul>
                {primaryStrategy.risks[0] && (
                  <div className="aula-risk-note"><AlertTriangle size={13} /> {primaryStrategy.risks[0]}</div>
                )}
              </>
            ) : <p className="aula-empty">Nessuna strategia disponibile</p>}
          </div>
        )}

        {slide === 2 && (
          <div className="aula-slide">
            <div className="aula-slide-label">03 — Contraddizioni da usare</div>
            {caseData.contradictions.length > 0 ? (
              <ul className="aula-contradictions">
                {caseData.contradictions.slice(0, 3).map((c, i) => (
                  <li key={i}>
                    <span className="aula-num">{i + 1}</span>
                    <div><strong>{c.title}</strong><p>{c.description}</p></div>
                  </li>
                ))}
              </ul>
            ) : <p className="aula-empty">Nessuna contraddizione rilevata</p>}
          </div>
        )}

        {slide === 3 && (
          <div className="aula-slide">
            <div className="aula-slide-label">04 — Testimoni chiave</div>
            {la?.witness_assessments.length ? (
              <div className="aula-witnesses">
                {la.witness_assessments.map((w, i) => (
                  <div key={i} className={`aula-witness aula-witness-${w.role}`}>
                    <div className="aula-witness-header">
                      <strong>{w.witness_name}</strong>
                      <span className={`witness-role-badge role-${w.role}`}>{witnessRoleLabel(w.role)}</span>
                      <span className="aula-cred" style={{ color: w.credibility_score >= 0.7 ? '#ef4444' : '#f97316' }}>{pct(w.credibility_score)}</span>
                    </div>
                    {w.vulnerabilities[0] && <p className="aula-vuln">⚡ {w.vulnerabilities[0]}</p>}
                    {w.cross_examination_angles[0] && <p className="aula-cross">→ {w.cross_examination_angles[0]}</p>}
                  </div>
                ))}
              </div>
            ) : <p className="aula-empty">Nessuna valutazione testimone disponibile</p>}
          </div>
        )}

        {slide === 4 && (
          <div className="aula-slide">
            <div className="aula-slide-label">05 — Azioni ora</div>
            {la?.immediate_actions.length ? (
              <ul className="aula-actions">
                {la.immediate_actions.slice(0, 5).map((a, i) => (
                  <li key={i}><CheckCircle2 size={14} /><span>{a}</span></li>
                ))}
              </ul>
            ) : <p className="aula-empty">Nessuna azione urgente definita</p>}
          </div>
        )}
      </div>

      <div className="aula-nav">
        <button className="aula-nav-btn" onClick={() => setSlide(s => Math.max(s - 1, 0))} disabled={slide === 0}>
          <ArrowLeft size={22} />
        </button>
        <span className="aula-nav-counter">{slide + 1} / {AULA_SLIDES}</span>
        <button className="aula-nav-btn" onClick={() => setSlide(s => Math.min(s + 1, AULA_SLIDES - 1))} disabled={slide === AULA_SLIDES - 1}>
          <ArrowRight size={22} />
        </button>
      </div>
    </div>
  );
}

// ── Chat ─────────────────────────────────────────────────────────────────────

function ChatDrawer({
  state, onClose, onSend, onQuickAction, onClear, streaming,
}: {
  state: ChatState;
  onClose: () => void;
  onSend: (msg: string) => void;
  onQuickAction: (key: string) => void;
  onClear: () => void;
  streaming: boolean;
}) {
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [state.messages, streaming]);

  useEffect(() => {
    if (state.open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [state.open]);

  const submit = () => {
    const t = input.trim();
    if (!t || streaming) return;
    setInput('');
    onSend(t);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const QUICK_ACTIONS = [
    { key: 'strategy',    label: 'Strategia del caso',   icon: Sparkles },
    { key: 'memoria',     label: 'Memoria difensiva',    icon: FileText },
    { key: 'cassazione',  label: 'Ricorso Cassazione',   icon: Scale },
    { key: 'eccezione',   label: 'Eccezione procedurale', icon: ShieldAlert },
    { key: 'crossExam',   label: 'Controesame testimoni', icon: Users },
    { key: 'clienteNote', label: 'Nota per il cliente',  icon: MessageSquare },
  ] as const;

  const isEmpty = state.messages.length === 0;

  return (
    <div className={`chat-overlay ${state.open ? 'chat-overlay--open' : ''}`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="chat-drawer">
        <div className="chat-header">
          <div className="chat-header-title">
            <div className="chat-header-icon"><Sparkles size={16} /></div>
            <div>
              <div className="chat-header-name">GiulIA</div>
              {state.caseContext && <div className="chat-header-sub">Conosce il fascicolo</div>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {state.messages.length > 0 && (
              <button className="chat-close-btn" onClick={onClear} title="Pulisci cronologia" style={{ opacity: 0.5 }}>
                <Trash2 size={16} />
              </button>
            )}
            <button className="chat-close-btn" onClick={onClose}><X size={20} /></button>
          </div>
        </div>

        {/* Quick actions — always visible when there's a case context */}
        {state.caseContext && (
          <div className="chat-quick-bar">
            {QUICK_ACTIONS.map(({ key, label, icon: Icon }) => (
              <button key={key} className="chat-quick-chip" onClick={() => onQuickAction(key)} disabled={streaming}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        )}

        <div className="chat-messages" ref={listRef}>
          {isEmpty && (
            <div className="chat-empty">
              <div className="chat-empty-icon"><Sparkles size={32} /></div>
              <h3>GiulIA</h3>
              {state.caseContext
                ? <p>Buongiorno, Collega. Ho letto il fascicolo. Posso redigere memorie, ricorsi, eccezioni, prepararti al controesame — o semplicemente ragionare insieme sulla strategia. Come posso aiutarti?</p>
                : <p>Buongiorno, Collega. Sono GiulIA, avvocata penalista. Conosco il Codice Penale, il c.p.p. e la giurisprudenza della Cassazione. Apri un fascicolo per lavorare su un caso specifico.</p>
              }
            </div>
          )}
          {state.messages.map(m => (
            <div key={m.id} className={`chat-bubble chat-bubble--${m.role}`}>
              {m.role === 'assistant'
                ? <div className="chat-md" dangerouslySetInnerHTML={{ __html: renderChatMarkdown(m.content) }} />
                : <span>{m.content}</span>
              }
            </div>
          ))}
          {streaming && state.messages[state.messages.length - 1]?.role === 'user' && (
            <div className="chat-bubble chat-bubble--assistant chat-bubble--loading">
              <span className="chat-dots"><span /><span /><span /></span>
            </div>
          )}
        </div>

        <div className="chat-input-row">
          <textarea
            ref={inputRef}
            className="chat-input"
            rows={1}
            placeholder={state.caseContext ? 'Chiedi qualcosa sul fascicolo, o richiedi un atto…' : 'Domanda di diritto penale italiano…'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
          />
          <button className="chat-send-btn" onClick={submit} disabled={!input.trim() || streaming}>
            {streaming ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function FloatingChatButton({ onClick, hasContext }: { onClick: () => void; hasContext: boolean }) {
  return (
    <button className={`chat-fab ${hasContext ? 'chat-fab--context' : ''}`} onClick={onClick} aria-label="Apri GiulIA">
      <MessageSquare size={26} />
      <span className="chat-fab-label">GiulIA</span>
      {hasContext && <span className="chat-fab-dot" />}
    </button>
  );
}

function renderChatMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/^---$/gm, '<hr>')
    .replace(/^• (.+)$/gm, '<li>$1</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>(\n|$))+/g, s => `<ul>${s}</ul>`)
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/^(?!<[hul])(.+)$/gm, (_, p) => p ? p : '')
    .replace(/\n/g, '<br>');
}

// ── Case list view ────────────────────────────────────────────────────────────

function HomepageStats({ cases }: { cases: CaseSummary[] }) {
  const critical = cases.filter(c => c.risk_level === 'critical' || c.risk_level === 'high').length;
  const totalContradictions = cases.reduce((s, c) => s + c.contradiction_count, 0);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = cases.filter(c => c.next_deadline_date && c.next_deadline_date >= today).length;

  return (
    <div className="home-stats">
      <div className="home-stat">
        <span className="home-stat-value">{cases.length}</span>
        <span className="home-stat-label">fascicoli</span>
      </div>
      <div className="home-stat-divider" />
      <div className="home-stat">
        <span className="home-stat-value" style={{ color: critical > 0 ? '#f87171' : '#4ade80' }}>{critical}</span>
        <span className="home-stat-label">alto rischio</span>
      </div>
      <div className="home-stat-divider" />
      <div className="home-stat">
        <span className="home-stat-value" style={{ color: upcoming > 0 ? '#fbbf24' : '#64748b' }}>{upcoming}</span>
        <span className="home-stat-label">scadenze attive</span>
      </div>
      <div className="home-stat-divider" />
      <div className="home-stat">
        <span className="home-stat-value" style={{ color: totalContradictions > 0 ? '#fb923c' : '#64748b' }}>{totalContradictions}</span>
        <span className="home-stat-label">contraddizioni</span>
      </div>
    </div>
  );
}

async function fetchWithWakeup(
  url: string,
  opts: { firstTimeoutMs: number; retryTimeoutMs: number; onSlow: () => void }
): Promise<Response> {
  const attempt = (timeoutMs: number) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
  };
  try {
    const r = await attempt(opts.firstTimeoutMs);
    if (r.ok) return r;
    throw new Error(`${r.status}`);
  } catch {
    opts.onSlow();
    return attempt(opts.retryTimeoutMs);
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

function useAuth() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    if (DEV_BYPASS_AUTH) {
      setSession({
        access_token: 'dev-bypass-token',
        refresh_token: 'dev-bypass-refresh',
        expires_in: 3600,
        token_type: 'bearer',
        user: {
          id: 'dev-user',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'dev@pocketlegal.local',
          app_metadata: {},
          user_metadata: {},
          created_at: new Date(0).toISOString(),
        },
      } as Session);
      return;
    }

    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);
  return session;
}

function AuthScreen() {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (tab === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        setInfo('Account creato. Puoi accedere subito.');
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-shell">
        <section className="auth-intro" aria-labelledby="auth-title">
          <div className="auth-brand auth-brand--hero">
            <div className="auth-brand-icon"><Scale size={20} /></div>
            <div>
              <div className="auth-brand-name">Pocket Legal Triage</div>
              <div className="auth-brand-sub">Fascicoli penali, ordinati prima dell'udienza</div>
            </div>
          </div>
          <h1 id="auth-title">Trasforma atti, scansioni e note in fascicoli verificabili.</h1>
          <p className="auth-lede">
            Timeline, scadenze candidate, prove, contraddizioni e domande aperte — con fonti e confidenza sempre visibili.
          </p>
          <ul className="auth-feature-list" aria-label="Cosa fa Pocket Legal Triage">
            <li><ShieldCheck size={18} /><div><strong>Privacy operativa</strong><span>I fascicoli restano sul dispositivo; invii all'AI solo ciò che scegli.</span></div></li>
            <li><FileText size={18} /><div><strong>Fonti prima delle conclusioni</strong><span>Ogni affermazione importante rimanda a quote, pagina o documento.</span></div></li>
            <li><CalendarClock size={18} /><div><strong>Scadenze da verificare</strong><span>Le date estratte restano candidate finché l'avvocato non le conferma.</span></div></li>
            <li><CheckSquare size={18} /><div><strong>Bozze e checklist, non decisioni</strong><span>Preparazione e triage sotto controllo del difensore, non un “AI lawyer”.</span></div></li>
          </ul>
        </section>

        <div className="auth-card">
          <div className="auth-card-kicker">Accesso riservato</div>
          <div className="auth-tabs">
            {(['login', 'signup'] as const).map(t => (
              <button key={t} className={`auth-tab${tab === t ? ' auth-tab--active' : ''}`} onClick={() => setTab(t)}>
                {t === 'login' ? 'Accedi' : 'Registrati'}
              </button>
            ))}
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <input className="auth-input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
            <input className="auth-input" type="password" placeholder="Password (min. 6 caratteri)" value={password} onChange={e => setPassword(e.target.value)} required />
            {error && <div className="auth-error">{error}</div>}
            {info && <div className="auth-info">{info}</div>}
            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? 'Caricamento…' : tab === 'login' ? 'Accedi al fascicolo' : 'Crea account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function ProfileDrawer({ session, onClose }: { session: Session; onClose: () => void }) {
  const [profile, setProfile] = useState<Omit<UserProfile, 'id'>>({ full_name: null, studio: null, phone: null });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from('profiles').select('full_name,studio,phone').eq('id', session.user.id).single()
      .then(({ data }) => { if (data) setProfile(data); });
  }, [session.user.id]);

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('profiles').upsert({ id: session.user.id, ...profile });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="profile-overlay" onClick={onClose}>
      <div className="profile-drawer" onClick={e => e.stopPropagation()}>
        <div className="profile-header">
          <div className="profile-title">Profilo</div>
          <button className="profile-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="profile-email">{session.user.email}</div>
        {[
          { label: 'Nome completo', key: 'full_name' as const, placeholder: 'Avv. Mario Rossi' },
          { label: 'Studio legale', key: 'studio' as const, placeholder: 'Studio Rossi & Associati' },
          { label: 'Telefono', key: 'phone' as const, placeholder: '+39 02 1234567' },
        ].map(({ label, key, placeholder }) => (
          <div key={key} className="profile-field">
            <label className="profile-label">{label}</label>
            <input className="profile-input" value={profile[key] ?? ''} onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} />
          </div>
        ))}
        <button className={`profile-save${saved ? ' profile-save--saved' : ''}`} onClick={handleSave} disabled={saving}>
          {saving ? 'Salvataggio…' : saved ? 'Salvato ✓' : 'Salva profilo'}
        </button>
        <button className="profile-logout" onClick={() => supabase.auth.signOut()}>
          <LogOut size={15} /> Esci dall'account
        </button>
      </div>
    </div>
  );
}

// ── Case list ─────────────────────────────────────────────────────────────────

function CaseListView({ onSelect, session, onToggleChat }: { onSelect: (id: string) => void; session: Session; onToggleChat: () => void }) {
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [localIds, setLocalIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [warming, setWarming] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [search, setSearch] = useState('');
  const [showProfile, setShowProfile] = useState(false);

  const filtered = useMemo(() => {
    if (!cases) return [];
    if (!search.trim()) return cases;
    const q = search.toLowerCase();
    return cases.filter(c =>
      c.case_title.toLowerCase().includes(q) ||
      c.charge_summary.toLowerCase().includes(q) ||
      c.client_name.toLowerCase().includes(q) ||
      c.case_summary.toLowerCase().includes(q)
    );
  }, [cases, search]);

  useEffect(() => {
    (async () => {
      // Local cases from IndexedDB — always available, even offline
      const local = (await dbList()) as CaseAnalysis[];
      const localSummaries = local.map(caseAnalysisToSummary);
      const localIdSet = new Set(local.map(c => c.case_id));
      setLocalIds(localIdSet);
      setCases(localSummaries);

      // Backend demo cases — patient retry to absorb Render free-tier cold start
      try {
        const r = await fetchWithWakeup(`${API}/api/cases`, {
          firstTimeoutMs: 5000,
          retryTimeoutMs: 45000,
          onSlow: () => setWarming(true),
        });
        if (!r.ok) throw new Error(`${r.status}`);
        const demo = await r.json() as CaseSummary[];
        setCases([...localSummaries, ...demo.filter(c => !localIdSet.has(c.case_id))]);
        setWarming(false);
      } catch {
        setWarming(false);
        if (localSummaries.length === 0) setError('Backend non raggiungibile e nessun fascicolo locale');
      }
    })();
  }, []);

  const handleCreate = useCallback(async (title: string) => {
    const newCase: CaseAnalysis = {
      case_id: crypto.randomUUID(), case_title: title, is_pending: true, raw_documents: [],
      language: 'it', case_summary: '', materials: [], timeline: [], people: [],
      evidence: [], open_questions: [], missing_documents: [], contradictions: [],
      procedural_deadlines: [], brief_markdown: '', usage_estimate: { pages: 0, audio_minutes: 0, flash_input_tokens: 0, flash_output_tokens: 0, pro_used: false, model_route: '' }, legal_analysis: null,
    };
    await dbSave(newCase);
    setShowUpload(false);
    setCases(prev => {
      const summary = caseAnalysisToSummary(newCase);
      return prev ? [summary, ...prev] : [summary];
    });
    setLocalIds(prev => new Set([...prev, newCase.case_id]));
    onSelect(newCase.case_id);
  }, [onSelect]);

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Eliminare il fascicolo? I dati sono conservati solo sul tuo dispositivo.')) return;
    await dbDelete(id);
    setCases(prev => prev?.filter(c => c.case_id !== id) ?? null);
    setLocalIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  }, []);

  return (
    <main className="app-shell home-shell">

      {/* ── Hero ── */}
      <header className="home-hero">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="home-brand">
            <div className="home-brand-icon"><Gavel size={22} /></div>
            <div>
              <div className="home-brand-name">Pocket Legal Triage</div>
              <div className="home-brand-tagline">Studio Legale · Milano</div>
            </div>
          </div>
          <button onClick={() => setShowProfile(true)} style={{ background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 10, padding: '9px 11px', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }} title="Profilo">
            <User size={16} />
          </button>
        </div>
        <h1 className="home-headline">
          I tuoi<br /><span className="home-headline-accent">fascicoli</span>
        </h1>
        {cases && <HomepageStats cases={cases} />}
      </header>
      {showProfile && <ProfileDrawer session={session} onClose={() => setShowProfile(false)} />}

      {/* ── GiulIA home card ── */}
      <section className="giulia-home-card">
        <div className="giulia-home-avatar">
          <Sparkles size={20} />
        </div>
        <div className="giulia-home-info">
          <div className="giulia-home-name">GiulIA</div>
          <div className="giulia-home-title">Avvocata penalista · Sempre a disposizione</div>
          <p className="giulia-home-desc">
            Buongiorno, Collega. Sono qui per assisterti. Chiedimi qualcosa sul diritto penale o apri un fascicolo per lavorare su un caso specifico.
          </p>
        </div>
        <div className="giulia-home-actions">
          <button className="giulia-home-chat-btn" onClick={onToggleChat}>
            <MessageSquare size={14} /> Chatta
          </button>
        </div>
      </section>

      {/* ── Actions bar ── */}
      <div className="home-actions-bar">
        {cases && cases.length > 1 && (
          <div className="cases-search-wrap home-search">
            <Search size={15} className="cases-search-icon" />
            <input
              className="cases-search"
              placeholder="Cerca cliente, accuse…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button className="cases-search-clear" onClick={() => setSearch('')}><X size={14} /></button>}
          </div>
        )}
        <button className="primary-button home-new-btn" onClick={() => setShowUpload(true)}>
          <Plus size={15} /> Nuovo fascicolo
        </button>
        <button className="secondary-button" onClick={() => document.getElementById('import-file-input')?.click()}>
          <Upload size={14} /> Importa
        </button>
        <input
          id="import-file-input"
          type="file"
          style={{ display: 'none' }}
          onChange={async e => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const text = await file.text();
              const data = JSON.parse(text);
              if (!data.case_id || !data.case_title) throw new Error('File non valido');
              const existing = await dbGet(data.case_id);
              if (existing) {
                const action = confirm(
                  `Il fascicolo "${data.case_title}" è già presente. \n\nOK = Sostituisci\nAnnulla = Salva come copia`
                );
                if (!action) {
                  data.case_id = crypto.randomUUID();
                  data.case_title += ' (importato)';
                }
              }
              await dbSave(data as CaseAnalysis);
              window.location.reload();
            } catch (err) {
              alert(`Importazione fallita: ${(err as Error).message}`);
            }
            e.target.value = '';
          }}
        />
      </div>

      {analyzing && (
        <div className="analyzing-banner">
          <Loader2 className="spin" size={18} />
          Analisi AI in corso — attendere…
        </div>
      )}

      {error && <div className="error-banner"><AlertTriangle size={16} /> {error}</div>}

      {warming && (
        <div className="warming-banner">
          <Loader2 className="spin" size={16} />
          Sto svegliando il server — può richiedere qualche secondo…
        </div>
      )}

      {cases === null && !error && (
        <div className="cases-loading"><Loader2 className="spin" size={32} /></div>
      )}

      {/* ── Cases grid ── */}
      <div className="cases-grid">
        {filtered.length === 0 && cases && (
          <p className="muted" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '32px 0' }}>
            Nessun fascicolo corrisponde a &ldquo;{search}&rdquo;
          </p>
        )}
        {filtered.map(c => (
          <button key={c.case_id} className={`case-card${localIds.has(c.case_id) ? ' case-card-local' : ''}`} onClick={() => onSelect(c.case_id)}>
            <div className="case-card-header">
              <div className="case-card-risk" style={{ background: riskColor(c.risk_level) + '22', border: `1px solid ${riskColor(c.risk_level)}55` }}>
                <span style={{ color: riskColor(c.risk_level) }}>{riskIcon(c.risk_level)} {riskLabel(c.risk_level)}</span>
              </div>
              <div className="case-card-actions">
                {localIds.has(c.case_id) && (
                  <span className="case-local-badge">locale</span>
                )}
                {localIds.has(c.case_id) && (
                  <span className="case-delete-btn" onClick={e => handleDelete(c.case_id, e)} title="Elimina fascicolo">
                    <Trash2 size={14} />
                  </span>
                )}
                <ChevronRight size={18} className="case-card-arrow" />
              </div>
            </div>
            <h3 className="case-card-title">{c.case_title}</h3>
            <p className="case-card-charges">{c.charge_summary}</p>
            <p className="case-card-summary">{c.case_summary}</p>
            <div className="case-card-footer">
              <div className="case-card-meta">
                {c.next_deadline_date && (
                  <span><CalendarClock size={13} /> {formatShortDate(c.next_deadline_date)}</span>
                )}
                <span><AlertTriangle size={13} /> {c.contradiction_count} contraddizioni</span>
                <span><FileText size={13} /> {c.material_count} materiali</span>
              </div>
              <span className="case-card-open">Apri <ChevronRight size={14} /></span>
            </div>
          </button>
        ))}
      </div>

      {showUpload && <NewCaseDrawer onClose={() => setShowUpload(false)} onCreate={handleCreate} />}
    </main>
  );
}

// ── Legal analysis tab ────────────────────────────────────────────────────────


function LegalAnalysisTab({ la, onSelectSource, onOpenChat, onUpdate }: {
  la: LegalAnalysis;
  onSelectSource: (s: SourceRef) => void;
  onOpenChat: (key: string) => void;
  onUpdate: (updater: (la: LegalAnalysis) => LegalAnalysis) => void;
}) {
  const [expandedCharge, setExpandedCharge] = useState<number | null>(0);
  const [expandedStrategy, setExpandedStrategy] = useState<number | null>(0);

  const updateCharge = (i: number, patch: Partial<ChargeAnalysis>) =>
    onUpdate(la => ({ ...la, charges: la.charges.map((c, idx) => idx === i ? { ...c, ...patch } : c) }));
  const deleteCharge = (i: number) =>
    onUpdate(la => ({ ...la, charges: la.charges.filter((_, idx) => idx !== i) }));
  const addCharge = () =>
    onUpdate(la => ({ ...la, charges: [...la.charges, { charge_code: '', charge_name: '', max_sentence: '', elements_required: [], available_defenses: [], prosecution_strength: 0.5, notes: '', source_refs: [] }] }));

  const updateElement = (ci: number, ei: number, patch: Partial<ChargeElement>) =>
    onUpdate(la => ({ ...la, charges: la.charges.map((c, idx) => idx === ci ? { ...c, elements_required: c.elements_required.map((e, j) => j === ei ? { ...e, ...patch } : e) } : c) }));
  const deleteElement = (ci: number, ei: number) =>
    onUpdate(la => ({ ...la, charges: la.charges.map((c, idx) => idx === ci ? { ...c, elements_required: c.elements_required.filter((_, j) => j !== ei) } : c) }));
  const addElement = (ci: number) =>
    onUpdate(la => ({ ...la, charges: la.charges.map((c, idx) => idx === ci ? { ...c, elements_required: [...c.elements_required, { element: '', description: '', status: 'disputed', notes: '', source_refs: [] }] } : c) }));

  const updateStrategy = (i: number, patch: Partial<DefenseStrategy>) =>
    onUpdate(la => ({ ...la, strategies: la.strategies.map((s, idx) => idx === i ? { ...s, ...patch } : s) }));
  const deleteStrategy = (i: number) =>
    onUpdate(la => ({ ...la, strategies: la.strategies.filter((_, idx) => idx !== i) }));
  const addStrategy = () =>
    onUpdate(la => ({ ...la, strategies: [...la.strategies, { title: '', strategy_type: '', priority: 'secondary', description: '', strengths: [], risks: [], required_evidence: [], source_refs: [] }] }));

  const updateIssue = (i: number, patch: Partial<ConstitutionalIssue>) =>
    onUpdate(la => ({ ...la, constitutional_issues: la.constitutional_issues.map((x, idx) => idx === i ? { ...x, ...patch } : x) }));
  const deleteIssue = (i: number) =>
    onUpdate(la => ({ ...la, constitutional_issues: la.constitutional_issues.filter((_, idx) => idx !== i) }));
  const addIssue = () =>
    onUpdate(la => ({ ...la, constitutional_issues: [...la.constitutional_issues, { title: '', issue_type: '', severity: 'significant', description: '', legal_basis: '', remedy: '', source_refs: [] }] }));

  const updateWitness = (i: number, patch: Partial<WitnessAssessment>) =>
    onUpdate(la => ({ ...la, witness_assessments: la.witness_assessments.map((w, idx) => idx === i ? { ...w, ...patch } : w) }));
  const deleteWitness = (i: number) =>
    onUpdate(la => ({ ...la, witness_assessments: la.witness_assessments.filter((_, idx) => idx !== i) }));
  const addWitness = () =>
    onUpdate(la => ({ ...la, witness_assessments: [...la.witness_assessments, { witness_name: '', role: 'neutral', credibility_score: 0.5, key_testimony: '', strengths: [], vulnerabilities: [], cross_examination_angles: [], source_refs: [] }] }));

  const updateBalance = (patch: Partial<EvidenceBalance>) =>
    onUpdate(la => ({ ...la, evidence_balance: { ...la.evidence_balance, ...patch } }));

  const RISK_OPTIONS: Array<{ value: 'low' | 'medium' | 'high' | 'critical'; label: string }> = [
    { value: 'low', label: 'Basso' }, { value: 'medium', label: 'Medio' },
    { value: 'high', label: 'Alto' }, { value: 'critical', label: 'Critico' },
  ];
  const ELEMENT_STATUS_OPTIONS: Array<{ value: ChargeElement['status']; label: string }> = [
    { value: 'proven', label: 'Provato' }, { value: 'disputed', label: 'Contestato' },
    { value: 'weak', label: 'Debole' }, { value: 'missing', label: 'Mancante' },
  ];
  const PRIORITY_OPTIONS: Array<{ value: DefenseStrategy['priority']; label: string }> = [
    { value: 'primary', label: 'Primaria' }, { value: 'secondary', label: 'Secondaria' }, { value: 'fallback', label: 'Fallback' },
  ];
  const SEVERITY_OPTIONS: Array<{ value: ConstitutionalIssue['severity']; label: string }> = [
    { value: 'critical', label: 'Critico' }, { value: 'significant', label: 'Significativo' }, { value: 'minor', label: 'Minore' },
  ];
  const WITNESS_ROLE_OPTIONS: Array<{ value: WitnessAssessment['role']; label: string }> = [
    { value: 'prosecution', label: 'Accusa' }, { value: 'defense', label: 'Difesa' },
    { value: 'neutral', label: 'Neutro' }, { value: 'expert', label: 'Esperto' },
  ];

  return (
    <section className="panel legal-panel">

      {/* Risk banner */}
      <div className="risk-banner" style={{ borderColor: riskColor(la.risk_level) + '66', background: riskColor(la.risk_level) + '11' }}>
        <div className="risk-banner-label" style={{ color: riskColor(la.risk_level) }}>
          {riskIcon(la.risk_level)} Rischio{' '}
          <EditableSelect
            value={la.risk_level}
            options={RISK_OPTIONS}
            onChange={v => onUpdate(la => ({ ...la, risk_level: v }))}
          />
        </div>
        <p>
          <Editable
            value={la.risk_summary}
            onChange={v => onUpdate(la => ({ ...la, risk_summary: v }))}
            placeholder="Sintesi del rischio…"
            multiline
          />
        </p>
      </div>

      {/* Immediate actions */}
      <div className="legal-section">
        <h2><Zap size={16} /> Azioni immediate</h2>
        <EditableStringList
          items={la.immediate_actions}
          onChange={items => onUpdate(la => ({ ...la, immediate_actions: items }))}
          placeholder="Azione immediata…"
          itemClass="action-item"
          icon={<CheckCircle2 size={14} />}
          addLabel="Aggiungi azione"
        />
      </div>

      {/* Charges */}
      <div className="legal-section">
        <h2><Scale size={16} /> Analisi delle accuse</h2>
        {la.charges.map((charge, ci) => (
          <div key={ci} className="charge-card">
            <div className="charge-card-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className="charge-card-toggle" onClick={() => setExpandedCharge(expandedCharge === ci ? null : ci)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'inherit' }}>
                {expandedCharge === ci ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div className="charge-card-title-row">
                  <span className="charge-code">
                    <Editable value={charge.charge_code} onChange={v => updateCharge(ci, { charge_code: v })} placeholder="art. …" />
                  </span>
                  <span className="charge-name">
                    <Editable value={charge.charge_name} onChange={v => updateCharge(ci, { charge_name: v })} placeholder="Nome reato" />
                  </span>
                </div>
                <div className="charge-card-meta-row">
                  <div className="strength-mini">
                    <div className="strength-mini-fill" style={{ width: `${charge.prosecution_strength * 100}%`, background: `hsl(${(1 - charge.prosecution_strength) * 120}, 70%, 50%)` }} />
                  </div>
                  <span className="charge-strength-label">
                    Accusa{' '}
                    <EditablePercent value={charge.prosecution_strength} onChange={v => updateCharge(ci, { prosecution_strength: v })} />
                  </span>
                </div>
              </div>
              <RowDelete onClick={() => deleteCharge(ci)} label={charge.charge_name} />
            </div>
            {expandedCharge === ci && (
              <div className="charge-card-body">
                <p className="charge-sentence">
                  <strong>Pena massima:</strong>{' '}
                  <Editable value={charge.max_sentence} onChange={v => updateCharge(ci, { max_sentence: v })} placeholder="es. anni 6" />
                </p>
                <h4>Elementi costitutivi</h4>
                <div className="elements-table">
                  {charge.elements_required.map((el, ei) => (
                    <div key={ei} className="element-row">
                      <div className="element-status-dot" style={{ background: elementStatusColor(el.status) }} title={elementStatusLabel(el.status)} />
                      <div className="element-body" style={{ flex: 1 }}>
                        <div className="editable-row-head">
                          <strong>
                            <Editable value={el.element} onChange={v => updateElement(ci, ei, { element: v })} placeholder="Elemento…" />
                          </strong>
                          <RowDelete onClick={() => deleteElement(ci, ei)} label={el.element} />
                        </div>
                        <p>
                          <Editable value={el.description} onChange={v => updateElement(ci, ei, { description: v })} placeholder="Descrizione…" multiline />
                        </p>
                        <p className="element-notes">
                          <Editable value={el.notes} onChange={v => updateElement(ci, ei, { notes: v })} placeholder="Note…" multiline />
                        </p>
                        <EditableSelect
                          value={el.status}
                          options={ELEMENT_STATUS_OPTIONS}
                          onChange={v => updateElement(ci, ei, { status: v })}
                          className={`element-chip element-${el.status}`}
                        />
                        <SourceRow refs={el.source_refs} onSelect={onSelectSource} />
                      </div>
                    </div>
                  ))}
                  <AddRowButton label="Aggiungi elemento" onClick={() => addElement(ci)} />
                </div>
                <h4>Difese disponibili</h4>
                <EditableStringList
                  items={charge.available_defenses}
                  onChange={items => updateCharge(ci, { available_defenses: items })}
                  placeholder="Difesa…"
                  addLabel="Aggiungi difesa"
                />
                <h4>Note</h4>
                <p className="charge-notes">
                  <Editable value={charge.notes} onChange={v => updateCharge(ci, { notes: v })} placeholder="Note sull'accusa…" multiline />
                </p>
                <SourceRow refs={charge.source_refs} onSelect={onSelectSource} />
              </div>
            )}
          </div>
        ))}
        <AddRowButton label="Aggiungi accusa" onClick={addCharge} />
      </div>

      {/* Defense strategies */}
      <div className="legal-section">
        <h2><ShieldCheck size={16} /> Strategie difensive</h2>
        {la.strategies.map((s, si) => (
          <div key={si} className={`strategy-card strategy-${s.priority}`}>
            <div className="strategy-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => setExpandedStrategy(expandedStrategy === si ? null : si)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'inherit' }}>
                {expandedStrategy === si ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </button>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div className="strategy-title-row">
                  <EditableSelect
                    value={s.priority}
                    options={PRIORITY_OPTIONS}
                    onChange={v => updateStrategy(si, { priority: v })}
                    className={`priority-badge priority-${s.priority}`}
                  />
                  <span className="strategy-type-badge">
                    <Editable value={s.strategy_type} onChange={v => updateStrategy(si, { strategy_type: v })} placeholder="tipo strategia" />
                  </span>
                </div>
                <div className="strategy-title">
                  <Editable value={s.title} onChange={v => updateStrategy(si, { title: v })} placeholder="Titolo strategia…" />
                </div>
              </div>
              <RowDelete onClick={() => deleteStrategy(si)} label={s.title} />
            </div>
            {expandedStrategy === si && (
              <div className="strategy-body">
                <p>
                  <Editable value={s.description} onChange={v => updateStrategy(si, { description: v })} placeholder="Descrizione…" multiline />
                </p>
                <div className="strategy-cols">
                  <div className="strategy-col">
                    <h4>Punti di forza</h4>
                    <EditableStringList
                      items={s.strengths}
                      onChange={items => updateStrategy(si, { strengths: items })}
                      placeholder="Punto di forza…"
                      itemClass="pro-item"
                      addLabel="Aggiungi"
                    />
                  </div>
                  <div className="strategy-col">
                    <h4>Rischi</h4>
                    <EditableStringList
                      items={s.risks}
                      onChange={items => updateStrategy(si, { risks: items })}
                      placeholder="Rischio…"
                      itemClass="risk-item"
                      addLabel="Aggiungi"
                    />
                  </div>
                </div>
                <h4>Prove necessarie</h4>
                <EditableStringList
                  items={s.required_evidence}
                  onChange={items => updateStrategy(si, { required_evidence: items })}
                  placeholder="Prova necessaria…"
                  icon={<Search size={12} />}
                  addLabel="Aggiungi prova"
                />
                <SourceRow refs={s.source_refs} onSelect={onSelectSource} />
              </div>
            )}
          </div>
        ))}
        <AddRowButton label="Aggiungi strategia" onClick={addStrategy} />
      </div>

      {/* Constitutional issues */}
      <div className="legal-section">
        <h2><ShieldAlert size={16} /> Problemi costituzionali / procedurali</h2>
        {la.constitutional_issues.length === 0 && <p className="muted">Nessun problema costituzionale.</p>}
        {la.constitutional_issues.map((issue, ii) => (
          <div key={ii} className={`issue-card issue-${issue.severity}`}>
            <div className="issue-header">
              <EditableSelect
                value={issue.severity}
                options={SEVERITY_OPTIONS}
                onChange={v => updateIssue(ii, { severity: v })}
                className={`severity-badge severity-${issue.severity}`}
              />
              <span className="issue-type">
                <Editable value={issue.issue_type} onChange={v => updateIssue(ii, { issue_type: v })} placeholder="tipo problema" />
              </span>
              <RowDelete onClick={() => deleteIssue(ii)} label={issue.title} />
            </div>
            <h3>
              <Editable value={issue.title} onChange={v => updateIssue(ii, { title: v })} placeholder="Titolo…" />
            </h3>
            <p>
              <Editable value={issue.description} onChange={v => updateIssue(ii, { description: v })} placeholder="Descrizione…" multiline />
            </p>
            <div className="issue-law">
              <BookOpen size={13} />{' '}
              <em>
                <Editable value={issue.legal_basis} onChange={v => updateIssue(ii, { legal_basis: v })} placeholder="Base legale…" multiline />
              </em>
            </div>
            <div className="issue-remedy">
              <ShieldCheck size={13} />
              <span>
                <Editable value={issue.remedy} onChange={v => updateIssue(ii, { remedy: v })} placeholder="Rimedio…" multiline />
              </span>
            </div>
            <SourceRow refs={issue.source_refs} onSelect={onSelectSource} />
          </div>
        ))}
        <AddRowButton label="Aggiungi problema" onClick={addIssue} />
      </div>

      {/* Witness assessments */}
      <div className="legal-section">
        <h2><Users size={16} /> Valutazione testimoni</h2>
        {la.witness_assessments.length === 0 && <p className="muted">Nessun testimone.</p>}
        {la.witness_assessments.map((w, wi) => (
          <div key={wi} className={`witness-card witness-${w.role}`}>
            <div className="witness-header">
              <div>
                <strong>
                  <Editable value={w.witness_name} onChange={v => updateWitness(wi, { witness_name: v })} placeholder="Nome testimone…" />
                </strong>
                <EditableSelect
                  value={w.role}
                  options={WITNESS_ROLE_OPTIONS}
                  onChange={v => updateWitness(wi, { role: v })}
                  className={`witness-role-badge role-${w.role}`}
                />
              </div>
              <div className="credibility-score" style={{ color: w.credibility_score >= 0.7 ? '#ef4444' : w.credibility_score >= 0.5 ? '#f97316' : '#22c55e' }}>
                <EditablePercent value={w.credibility_score} onChange={v => updateWitness(wi, { credibility_score: v })} /> cred.
              </div>
              <RowDelete onClick={() => deleteWitness(wi)} label={w.witness_name} />
            </div>
            <StrengthBar value={w.credibility_score} label="Credibilità percepita" color={`hsl(${(1 - w.credibility_score) * 30}, 80%, 55%)`} />
            <p className="witness-testimony">&ldquo;
              <Editable value={w.key_testimony} onChange={v => updateWitness(wi, { key_testimony: v })} placeholder="Testimonianza chiave…" multiline />
            &rdquo;</p>
            <div className="witness-cols">
              <div>
                <h4>Punti forti</h4>
                <EditableStringList
                  items={w.strengths}
                  onChange={items => updateWitness(wi, { strengths: items })}
                  placeholder="Punto forte…"
                  itemClass="pro-item"
                  addLabel="Aggiungi"
                />
              </div>
              <div>
                <h4>Vulnerabilità</h4>
                <EditableStringList
                  items={w.vulnerabilities}
                  onChange={items => updateWitness(wi, { vulnerabilities: items })}
                  placeholder="Vulnerabilità…"
                  itemClass="risk-item"
                  addLabel="Aggiungi"
                />
              </div>
            </div>
            <h4>Domande cross-examination</h4>
            <EditableStringList
              items={w.cross_examination_angles}
              onChange={items => updateWitness(wi, { cross_examination_angles: items })}
              placeholder="Domanda…"
              icon={<ArrowRight size={12} />}
              addLabel="Aggiungi domanda"
            />
            <SourceRow refs={w.source_refs} onSelect={onSelectSource} />
            <button
              className="giulia-ctx-btn"
              onClick={() => onOpenChat(`Preparami una sequenza di controesame per ${w.witness_name} (${w.role}, credibilità ${Math.round(w.credibility_score * 100)}%). Testimonianza chiave: "${w.key_testimony}". Vulnerabilità note: ${w.vulnerabilities.join('; ') || 'da sviluppare'}. Usa domande chiuse sì/no per massimizzare l'impatto.`)}
            >
              <MessageSquare size={12} /> Prepara controesame con GiulIA
            </button>
          </div>
        ))}
        <AddRowButton label="Aggiungi testimone" onClick={addWitness} />
      </div>

      {/* Evidence balance */}
      <div className="legal-section">
        <h2><Scale size={16} /> Equilibrio probatorio</h2>
        <div className="balance-card">
          <div className="balance-bars">
            <div>
              <span className="muted" style={{ fontSize: '0.78rem' }}>Forza accusa:{' '}
                <EditablePercent value={la.evidence_balance.prosecution_strength} onChange={v => updateBalance({ prosecution_strength: v })} />
              </span>
              <StrengthBar value={la.evidence_balance.prosecution_strength} label="Forza accusa" color="#ef4444" />
            </div>
            <div>
              <span className="muted" style={{ fontSize: '0.78rem' }}>Forza difesa:{' '}
                <EditablePercent value={la.evidence_balance.defense_strength} onChange={v => updateBalance({ defense_strength: v })} />
              </span>
              <StrengthBar value={la.evidence_balance.defense_strength} label="Forza difesa" color="#22c55e" />
            </div>
          </div>
          <div className="balance-cols">
            <div>
              <h4>Prove accusa</h4>
              <EditableStringList
                items={la.evidence_balance.key_prosecution_evidence}
                onChange={items => updateBalance({ key_prosecution_evidence: items })}
                placeholder="Prova accusa…"
                itemClass="risk-item"
                addLabel="Aggiungi"
              />
            </div>
            <div>
              <h4>Prove difesa</h4>
              <EditableStringList
                items={la.evidence_balance.key_defense_evidence}
                onChange={items => updateBalance({ key_defense_evidence: items })}
                placeholder="Prova difesa…"
                itemClass="pro-item"
                addLabel="Aggiungi"
              />
            </div>
          </div>
          <div className="balance-gaps">
            <h4><Search size={13} /> Lacune critiche</h4>
            <EditableStringList
              items={la.evidence_balance.critical_gaps}
              onChange={items => updateBalance({ critical_gaps: items })}
              placeholder="Lacuna…"
              addLabel="Aggiungi lacuna"
            />
          </div>
          <p className="balance-assessment">
            <Editable
              value={la.evidence_balance.overall_assessment}
              onChange={v => updateBalance({ overall_assessment: v })}
              placeholder="Valutazione complessiva…"
              multiline
            />
          </p>
        </div>
      </div>

      {/* Client summary */}
      <div className="client-summary-box">
        <h2><Users size={16} /> Sintesi per il cliente</h2>
        <p>
          <Editable
            value={la.client_summary}
            onChange={v => onUpdate(la => ({ ...la, client_summary: v }))}
            placeholder="Sintesi per il cliente…"
            multiline
          />
        </p>
      </div>

      {/* AI drafting */}
      <div className="legal-drafting-box">
        <div className="legal-drafting-header">
          <Sparkles size={16} />
          <div>
            <div className="legal-drafting-title">Redazione atti con AI</div>
            <div className="legal-drafting-sub">Memorie, ricorsi, eccezioni — ragionamento giuridico reale, non template</div>
          </div>
        </div>
        <div className="legal-drafting-grid">
          {([
            { key: 'memoria',    label: 'Memoria difensiva',     desc: 'Atto completo con IN FATTO, IN DIRITTO e CONCLUSIONI', icon: FileText },
            { key: 'cassazione', label: 'Ricorso Cassazione',    desc: 'Motivi ex art. 606 c.p.p. con giurisprudenza', icon: Scale },
            { key: 'eccezione',  label: 'Eccezione procedurale', desc: 'Nullità / inutilizzabilità / inammissibilità', icon: ShieldAlert },
            { key: 'crossExam',  label: 'Controesame',           desc: 'Schema domande per ciascun testimone dell\'accusa', icon: Users },
            { key: 'strategy',   label: 'Analisi strategica',    desc: 'Valutazione realistica di ogni linea difensiva', icon: Sparkles },
          ] as const).map(({ key, label, desc, icon: Icon }) => (
            <button key={key} className="legal-drafting-card" onClick={() => onOpenChat(key)}>
              <div className="legal-drafting-card-icon"><Icon size={18} /></div>
              <div className="legal-drafting-card-label">{label}</div>
              <div className="legal-drafting-card-desc">{desc}</div>
            </button>
          ))}
        </div>
        <p className="legal-drafting-note">
          L'AI conosce il Codice Penale, il c.p.p. e la giurisprudenza della Cassazione. Puoi anche fare domande libere nella chat.
        </p>
      </div>
    </section>
  );
}

// ── Redaction components ──────────────────────────────────────────────────────

function RedactionDrawer({
  globalRules, setGlobalRules,
  caseRules, setCaseRules,
  onClose, caseCtx, apiBase,
}: {
  globalRules: RedactionRule[]; setGlobalRules: (r: RedactionRule[]) => void;
  caseRules: RedactionRule[]; setCaseRules: (r: RedactionRule[]) => void;
  onClose: () => void; caseCtx: string; apiBase: string;
}) {
  const [origInput, setOrigInput] = useState('');
  const [replInput, setReplInput] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [suggested, setSuggested] = useState<RedactionRule[]>([]);

  const addRule = (target: 'global' | 'case') => {
    if (!origInput.trim()) return;
    const rule: RedactionRule = { id: crypto.randomUUID(), original: origInput.trim(), replacement: replInput.trim() || '[OMISSIS]', enabled: true };
    if (target === 'global') setGlobalRules([...globalRules, rule]);
    else setCaseRules([...caseRules, rule]);
    setOrigInput(''); setReplInput('');
  };

  const handleDetect = async () => {
    setDetecting(true); setSuggested([]);
    try {
      const res = await fetch(`${apiBase}/api/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: REDACT_DETECT_PROMPT(caseCtx) }], mode: 'flash' }),
      });
      if (!res.ok || !res.body) return;
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = ''; let full = '';
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const p = line.slice(6).trim(); if (p === '[DONE]') break;
          try { full += (JSON.parse(p) as { text: string }).text; } catch {}
        }
      }
      const rules: RedactionRule[] = full.split('\n').flatMap(line => {
        const m = line.match(/^(.+?)\s*→\s*(.+)$/);
        if (!m) return [];
        return [{ id: crypto.randomUUID(), original: m[1].trim(), replacement: m[2].trim(), enabled: true }];
      });
      setSuggested(rules);
    } finally { setDetecting(false); }
  };

  const RuleList = ({ rules, onChange, title }: { rules: RedactionRule[]; onChange: (r: RedactionRule[]) => void; title: string }) => (
    <div className="redact-section">
      <p className="eyebrow">{title}</p>
      {rules.length === 0 && <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 8 }}>Nessuna regola.</p>}
      {rules.map((r, i) => (
        <div key={r.id} className="redact-rule-item">
          <span className="redact-original">{r.original}</span>
          <span className="redact-arrow">→</span>
          <span className="redact-replacement">{r.replacement}</span>
          <button className="redact-toggle-chip" onClick={() => onChange(rules.map((x, j) => j === i ? { ...x, enabled: !x.enabled } : x))}>
            {r.enabled ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
          <button className="redact-delete-btn" onClick={() => onChange(rules.filter((_, j) => j !== i))}><X size={12} /></button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="source-drawer redact-drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-handle" />
        <div className="drawer-header">
          <div><p className="eyebrow">Privacy</p><h2>Gestione redazione</h2></div>
          <button onClick={onClose} className="ghost-button">Chiudi</button>
        </div>

        <div className="redact-add-form">
          <p className="eyebrow">Aggiungi regola</p>
          <div className="redact-add-row">
            <input className="upload-input" placeholder="Parola originale (es. Mario Rossi)" value={origInput} onChange={e => setOrigInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRule('global')} />
            <span style={{ color: '#64748b', flexShrink: 0 }}>→</span>
            <input className="upload-input" placeholder="[OMISSIS]" value={replInput} onChange={e => setReplInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRule('global')} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="ghost-button" style={{ fontSize: '0.8rem', padding: '8px 12px' }} onClick={() => addRule('global')} disabled={!origInput.trim()}>+ Globale</button>
            <button className="ghost-button" style={{ fontSize: '0.8rem', padding: '8px 12px' }} onClick={() => addRule('case')} disabled={!origInput.trim()}>+ Solo questo caso</button>
          </div>
        </div>

        <RuleList rules={globalRules} onChange={setGlobalRules} title="Regole globali (tutti i fascicoli)" />
        <RuleList rules={caseRules} onChange={setCaseRules} title="Regole per questo fascicolo" />

        <div className="redact-section">
          <p className="eyebrow">Rilevamento AI</p>
          <button className="ghost-button" style={{ width: '100%', justifyContent: 'center', gap: 8 }} onClick={handleDetect} disabled={detecting}>
            {detecting ? <><Loader2 size={14} className="spin" /> Analisi in corso…</> : <><Sparkles size={14} /> Rileva dati sensibili con AI</>}
          </button>
          {suggested.length > 0 && (
            <div className="redact-suggested">
              <p className="eyebrow" style={{ marginTop: 12 }}>Suggeriti ({suggested.length})</p>
              {suggested.map(r => (
                <div key={r.id} className="redact-rule-item">
                  <span className="redact-original">{r.original}</span>
                  <span className="redact-arrow">→</span>
                  <span className="redact-replacement">{r.replacement}</span>
                  <button className="ghost-button" style={{ fontSize: '0.7rem', padding: '4px 8px', borderRadius: 6 }}
                    onClick={() => { setCaseRules([...caseRules, r]); setSuggested(suggested.filter(s => s.id !== r.id)); }}>
                    + Aggiungi
                  </button>
                </div>
              ))}
              <button className="primary-button" style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}
                onClick={() => { setCaseRules([...caseRules, ...suggested]); setSuggested([]); }}>
                Accetta tutte
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function AnonModal({ text, onClose }: { text: string; onClose: () => void }) {
  const lines = markdownToLines(text);
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="source-drawer anon-modal" onClick={e => e.stopPropagation()}>
        <div className="drawer-handle" />
        <div className="drawer-header">
          <div><p className="eyebrow">Versione anonimizzata</p><h2>Testo redatto</h2></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="ghost-button" onClick={() => navigator.clipboard.writeText(text).catch(() => {})}><Copy size={15} /></button>
            {typeof navigator.share === 'function' && (
              <button className="ghost-button" onClick={() => navigator.share({ title: 'Testo anonimizzato', text }).catch(() => {})}><Share2 size={15} /></button>
            )}
            <button className="ghost-button" onClick={onClose}>Chiudi</button>
          </div>
        </div>
        <div className="material-content anon-content">
          {text
            ? lines.map((line, i) => {
                if (line.startsWith('## ')) return <h2 key={i}>{line.slice(3)}</h2>;
                if (line.startsWith('- ')) return <p className="bullet" key={i}>• {line.slice(2)}</p>;
                return <p key={i}>{line.replaceAll('**', '')}</p>;
              })
            : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 0' }}><Loader2 className="spin" size={28} /><p>Anonimizzazione in corso…</p></div>
          }
        </div>
      </aside>
    </div>
  );
}

// ── Case detail view ──────────────────────────────────────────────────────────

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'timeline', label: 'Cronologia' },
  { id: 'deadlines', label: 'Agenda' },
  { id: 'facts', label: 'Persone & prove' },
  { id: 'legal', label: 'Analisi legale' },
  { id: 'questions', label: 'Da verificare' },
  { id: 'brief', label: 'Promemoria' },
];

function CaseDetailView({ caseId, onBack, onOpenChat, onCaseLoaded, onCaseAnalyzed }: { caseId: string; onBack: () => void; onOpenChat: (key: string) => void; onCaseLoaded: (d: CaseAnalysis) => void; onCaseAnalyzed?: (d: CaseAnalysis) => void }) {
  const [caseData, setCaseData] = useState<CaseAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('timeline');
  const [selectedSource, setSelectedSource] = useState<SourceRef | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [selectedRawDoc, setSelectedRawDoc] = useState<RawDocument | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [uploadProcessing, setUploadProcessing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aulaModeActive, setAulaModeActive] = useState(false);
  const [redactionActive, setRedactionActive] = useState(false);
  const [showRedactionDrawer, setShowRedactionDrawer] = useState(false);
  const [anonModal, setAnonModal] = useState<string | null>(null);
  const [anonymizingDocId, setAnonymizingDocId] = useState<string | null>(null);

  const { toast, showToast, dismissToast } = useToast();
  const { toggle: toggleTask, isDone, doneCount } = useCompletedTasks(caseId);
  const { globalRules, setGlobalRules } = useRedactionRules();

  const exportBrief = useCallback(async () => {
    if (!caseData) return;
    try {
      await navigator.clipboard.writeText(caseData.brief_markdown);
      showToast('Promemoria copiato negli appunti!');
    } catch {
      showToast('Copia non riuscita', 'error');
    }
  }, [caseData, showToast]);

  const exportBriefDocx = useCallback(async () => {
    if (!caseData) return;
    try {
      const res = await fetch(`${API}/api/export-brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_title: caseData.case_title, brief_markdown: caseData.brief_markdown }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${caseData.case_title.replace(/[^\w\s-]/g, '').trim()}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast(`Errore export: ${(e as Error).message}`, 'error');
    }
  }, [caseData, showToast]);

  const shareBrief = useCallback(async () => {
    if (!caseData) return;
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title: caseData.case_title, text: caseData.brief_markdown }); return; } catch {}
    }
    exportBrief();
  }, [caseData, exportBrief]);

  const timelineRef = useRef<HTMLElement | null>(null);
  const deadlinesRef = useRef<HTMLElement | null>(null);
  const contradictionsRef = useRef<HTMLHeadingElement | null>(null);
  const materialsRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (caseId === '__new__') {
      const nc = (window as any).__newCase as CaseAnalysis | undefined;
      if (nc) { setCaseData(nc); onCaseLoaded(nc); return; }
    }
    (async () => {
      // Check IndexedDB first — data stays local
      const local = await dbGet(caseId) as CaseAnalysis | null;
      if (local) { setCaseData(local); onCaseLoaded(local); return; }
      // Fall back to backend demo cases
      try {
        const r = await fetch(`${API}/api/cases/${caseId}`);
        if (!r.ok) throw new Error(`${r.status}`);
        const d = await r.json() as CaseAnalysis;
        setCaseData(d); onCaseLoaded(d);
      } catch (e) { setError((e as Error).message); }
    })();
  }, [caseId]);

  const scrollTo = (ref: React.RefObject<HTMLElement | HTMLHeadingElement | null>) => {
    setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  };

  // ── Upload queue callbacks ──────────────────────────────────────────────
  const handleAddFiles = useCallback((files: File[]) => {
    const newItems: UploadQueueItem[] = files.map(f => ({
      id: crypto.randomUUID(),
      file: f,
      name: f.name,
      size: f.size,
      status: 'pending' as const,
      description: f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
    }));
    setUploadQueue(prev => [...prev, ...newItems]);
  }, []);

  const handleAddTextItem = useCallback((text: string, name?: string) => {
    const item: UploadQueueItem = {
      id: crypto.randomUUID(),
      file: new File([text], name || 'testo', { type: 'text/plain' }),
      name: name || 'Testo incollato',
      size: text.length,
      status: 'done',
      text,
      description: name || 'Testo incollato',
    };
    setUploadQueue(prev => [...prev, item]);
  }, []);

  const processQueue = useCallback(async () => {
    const pending = uploadQueue.filter(i => i.status === 'pending');
    if (pending.length === 0) return;

    setUploadProcessing(true);
    setUploadQueue(prev => prev.map(i =>
      i.status === 'pending' ? { ...i, status: 'uploading' as const } : i
    ));

    for (const item of pending) {
      try {
        let text = '';
        if (item.file.type.startsWith('text/') || item.file.name.endsWith('.txt')) {
          text = await item.file.text();
        } else {
          const fd = new FormData();
          fd.append('file', item.file);
          const res = await fetch(`${API}/api/upload`, { method: 'POST', body: fd });
          if (!res.ok) throw new Error(`Upload fallito (${res.status})`);
          const data = await res.json();
          text = data.extracted_text ?? '';
        }
        setUploadQueue(prev => prev.map(i =>
          i.id === item.id ? { ...i, status: 'done' as const, text } : i
        ));
      } catch (e) {
        setUploadQueue(prev => prev.map(i =>
          i.id === item.id ? { ...i, status: 'error' as const, error: (e as Error).message } : i
        ));
      }
    }

    setUploadProcessing(false);
  }, [uploadQueue]);

  const handleSaveAll = useCallback(async () => {
    if (!caseData) return;
    const doneItems = uploadQueue.filter(i => i.status === 'done' && i.text);
    if (doneItems.length === 0) return;

    const newDocs: RawDocument[] = doneItems.map(i => ({
      doc_id: i.id,
      name: i.description || i.name,
      description: i.description || i.name,
      text: i.text!,
      added_at: new Date().toISOString(),
    }));

    const updated = {
      ...caseData,
      raw_documents: [...(caseData.raw_documents ?? []), ...newDocs],
    };
    await dbSave(updated);
    setCaseData(updated);
    setUploadQueue(prev => prev.filter(i => !doneItems.find(d => d.id === i.id)));
    showToast(`${doneItems.length} documento${doneItems.length > 1 ? 'i' : ''} aggiunto/i al fascicolo`);
  }, [caseData, uploadQueue, showToast]);

  const handleRemoveQueueItem = useCallback((id: string) => {
    setUploadQueue(prev => prev.filter(i => i.id !== id));
  }, []);

  const handleRetryQueueItem = useCallback((id: string) => {
    setUploadQueue(prev => prev.map(i =>
      i.id === id ? { ...i, status: 'pending' as const, error: undefined } : i
    ));
  }, []);

  // Auto-start processing when drawer opens with pending items
  useEffect(() => {
    if (showUpload && uploadQueue.some(i => i.status === 'pending')) {
      processQueue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showUpload]);

  const handleDeleteDoc = useCallback(async (docId: string) => {
    if (!caseData) return;
    const updated = { ...caseData, raw_documents: (caseData.raw_documents ?? []).filter(d => d.doc_id !== docId) };
    await dbSave(updated);
    setCaseData(updated);
    showToast("Documento eliminato");
  }, [caseData, showToast]);

  const handleDeleteMaterial = useCallback(async (materialId: string) => {
    if (!caseData) return;
    const updated = { ...caseData, materials: caseData.materials.filter(m => m.id !== materialId) };
    await dbSave(updated);
    setCaseData(updated);
    showToast("Materiale eliminato");
  }, [caseData, showToast]);

  const handleExport = useCallback((includeDocs = false) => {
    if (!caseData) return;
    const exportData = {
      ...caseData,
      raw_documents: includeDocs ? caseData.raw_documents : [],
      redaction_rules: [],
      analyzed_doc_ids: [],
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${caseData.case_id}.plt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(includeDocs ? 'Fascicolo esportato con documenti originali' : 'Fascicolo esportato');
  }, [caseData, showToast]);

  const updateCase = useCallback(async (updater: (c: CaseAnalysis) => CaseAnalysis) => {
    if (!caseData) return;
    const updated = updater(caseData);
    await dbSave(updated);
    setCaseData(updated);
  }, [caseData]);

  const fetchChatFull = useCallback(async (userMessage: string): Promise<string> => {
    const res = await fetch(`${API}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: userMessage }], mode: 'flash' }),
    });
    if (!res.ok || !res.body) throw new Error(`${res.status}`);
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = ''; let full = '';
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const p = line.slice(6).trim(); if (p === '[DONE]') break;
        try { full += (JSON.parse(p) as { text: string }).text; } catch {}
      }
    }
    return full;
  }, []);

  const handleAnonymizeBrief = useCallback(async () => {
    if (!caseData) return;
    setAnonModal(''); // empty = loading
    try {
      const result = await fetchChatFull(REDACT_APPLY_PROMPT(caseData.brief_markdown));
      setAnonModal(result);
    } catch (e) {
      setAnonModal(null);
      showToast(`Errore: ${(e as Error).message}`, 'error');
    }
  }, [caseData, fetchChatFull, showToast]);

  const handleAnonymizeDoc = useCallback(async (docId: string) => {
    if (!caseData) return;
    const doc = (caseData.raw_documents ?? []).find(d => d.doc_id === docId);
    if (!doc) return;
    setAnonymizingDocId(docId);
    try {
      const anonText = await fetchChatFull(REDACT_APPLY_PROMPT(doc.text));
      const updated = { ...caseData, raw_documents: (caseData.raw_documents ?? []).map(d => d.doc_id === docId ? { ...d, text: anonText, name: d.name.startsWith('[ANONIMIZZATO] ') ? d.name : `[ANONIMIZZATO] ${d.name}` } : d) };
      await dbSave(updated);
      setCaseData(updated);
      showToast('Documento anonimizzato');
    } catch (e) {
      showToast(`Errore: ${(e as Error).message}`, 'error');
    } finally {
      setAnonymizingDocId(null);
    }
  }, [caseData, fetchChatFull, showToast]);

  const handleAnalyze = useCallback(async () => {
    if (!caseData) return;
    const docs = caseData.raw_documents ?? [];
    if (docs.length === 0) {
      showToast('Aggiungi almeno un documento prima di analizzare', 'error');
      return;
    }

    const analyzedIds = new Set(caseData.analyzed_doc_ids ?? []);
    const newDocs = docs.filter(d => !analyzedIds.has(d.doc_id));
    const isIncremental = caseData.legal_analysis != null && newDocs.length > 0;

    setShowUpload(false);
    setAnalyzing(true);
    try {
      const sourceDocs = isIncremental ? newDocs : docs;
      const docMaterials = sourceDocs.map(d => ({ name: d.description || d.name, kind: 'text', text: d.text }));
      const ctxMaterial = buildUserContextMaterial(caseData);
      const materials = ctxMaterial ? [ctxMaterial, ...docMaterials] : docMaterials;
      const res = await fetch(`${API}/api/analyze-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_title: caseData.case_title, materials, mode: 'flash', language: 'it' }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const merged = mergeWithAi(caseData, await res.json() as CaseAnalysis);
      // Dopo l'analisi, elimina automaticamente i documenti raw processati
      const analyzedDocIds = docs.map(d => d.doc_id);
      const updated = { ...merged, raw_documents: [], analyzed_doc_ids: analyzedDocIds };
      await dbSave(updated);
      setCaseData(updated);
      onCaseLoaded(updated);
      onCaseAnalyzed?.(updated);
    } catch (e) {
      showToast(`Errore analisi: ${(e as Error).message}`, 'error');
    } finally {
      setAnalyzing(false);
    }
  }, [caseData, showToast, onCaseLoaded, onCaseAnalyzed]);

  const setCaseRedactionRules = useCallback((rules: RedactionRule[]) => {
    updateCase(c => ({ ...c, redaction_rules: rules }));
  }, [updateCase]);

  // ── List edit helpers (Pass 1: timeline, people, evidence, contradictions) ──
  const addTimelineEvent = () => updateCase(c => ({
    ...c,
    timeline: [...c.timeline, { date: '', time: null, title: '', description: '', source_refs: [], confidence: 1 }],
  }));
  const updateTimelineEvent = (i: number, patch: Partial<TimelineEvent>) => updateCase(c => ({
    ...c, timeline: c.timeline.map((ev, idx) => idx === i ? { ...ev, ...patch } : ev),
  }));
  const deleteTimelineEvent = (i: number) => updateCase(c => ({
    ...c, timeline: c.timeline.filter((_, idx) => idx !== i),
  }));

  const addPerson = () => updateCase(c => ({
    ...c, people: [...c.people, { name: '', role: '', notes: '', source_refs: [] }],
  }));
  const updatePerson = (i: number, patch: Partial<Person>) => updateCase(c => ({
    ...c, people: c.people.map((p, idx) => idx === i ? { ...p, ...patch } : p),
  }));
  const deletePerson = (i: number) => updateCase(c => ({
    ...c, people: c.people.filter((_, idx) => idx !== i),
  }));

  const addEvidence = () => updateCase(c => ({
    ...c, evidence: [...c.evidence, { title: '', status: '', notes: '', source_refs: [] }],
  }));
  const updateEvidence = (i: number, patch: Partial<EvidenceItem>) => updateCase(c => ({
    ...c, evidence: c.evidence.map((ev, idx) => idx === i ? { ...ev, ...patch } : ev),
  }));
  const deleteEvidence = (i: number) => updateCase(c => ({
    ...c, evidence: c.evidence.filter((_, idx) => idx !== i),
  }));

  const addContradiction = () => updateCase(c => ({
    ...c, contradictions: [...c.contradictions, { title: '', description: '', source_refs: [] }],
  }));
  const updateContradiction = (i: number, patch: Partial<Contradiction>) => updateCase(c => ({
    ...c, contradictions: c.contradictions.map((ct, idx) => idx === i ? { ...ct, ...patch } : ct),
  }));
  const deleteContradiction = (i: number) => updateCase(c => ({
    ...c, contradictions: c.contradictions.filter((_, idx) => idx !== i),
  }));

  const addOpenQuestion = () => updateCase(c => ({
    ...c, open_questions: [...c.open_questions, { question: '', why_it_matters: '', source_refs: [] }],
  }));
  const updateOpenQuestion = (i: number, patch: Partial<OpenQuestion>) => updateCase(c => ({
    ...c, open_questions: c.open_questions.map((q, idx) => idx === i ? { ...q, ...patch } : q),
  }));
  const deleteOpenQuestion = (i: number) => updateCase(c => ({
    ...c, open_questions: c.open_questions.filter((_, idx) => idx !== i),
  }));

  if (error) return (
    <main className="app-shell loading-shell">
      <AlertTriangle /><h1>Errore</h1><p>{error}</p>
      <button className="ghost-button" onClick={onBack}>← Torna ai fascicoli</button>
    </main>
  );

  if (!caseData) return (
    <main className="app-shell loading-shell">
      <Loader2 className="spin" size={40} /><p>Carico fascicolo…</p>
    </main>
  );

  const rawDocs = caseData.raw_documents ?? [];
  const analyzedIdsSet = new Set(caseData.analyzed_doc_ids ?? []);
  const unanalyzedCount = rawDocs.filter(d => !analyzedIdsSet.has(d.doc_id)).length;
  const hasExistingAnalysis = caseData.legal_analysis != null;
  const caseRedactionRules = caseData.redaction_rules ?? [];
  const mergedRules = mergeRedactionRules(globalRules, caseRedactionRules);
  const d = (redactionActive && mergedRules.some(r => r.enabled && r.original.trim()))
    ? applyRedactionToCase(caseData, mergedRules) : caseData;
  const la = d.legal_analysis;
  const nextDeadline = [...d.procedural_deadlines].sort((a, b) =>
    `${a.due_date}T${a.due_time ?? '23:59'}`.localeCompare(`${b.due_date}T${b.due_time ?? '23:59'}`)
  )[0];

  return (
    <main className="app-shell">
      {/* Back button */}
      <button className="back-button" onClick={onBack}><ArrowLeft size={15} /> Fascicoli</button>

      {analyzing && (
        <div className="analyzing-banner"><Loader2 className="spin" size={18} /> Analisi AI in corso…</div>
      )}

      {/* Hero */}
      <section className="hero-card">
        <div className="hero-topline">
          <span><Gavel size={14} /> Pocket Legal Triage</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {la && (
              <div className="risk-pill" style={{ background: riskColor(la.risk_level) + '22', border: `1px solid ${riskColor(la.risk_level)}55`, color: riskColor(la.risk_level) }}>
                {riskIcon(la.risk_level)} Rischio {riskLabel(la.risk_level)}
              </div>
            )}
            <button
              className={`ghost-button redact-toggle-btn${redactionActive ? ' redact-toggle-active' : ''}`}
              onClick={() => setShowRedactionDrawer(true)}
              title="Gestione redazione dati"
            >
              {redactionActive ? <EyeOff size={13} /> : <Eye size={13} />}
              {redactionActive ? 'Redatto' : 'Redigi'}
            </button>
            <div className="export-dropdown" style={{ position: 'relative' }}>
              <button
                className="ghost-button"
                onClick={() => {
                  const el = document.getElementById('export-menu');
                  el?.classList.toggle('export-menu--open');
                }}
                title="Esporta fascicolo"
              >
                <Share2 size={13} /> Esporta
              </button>
              <div id="export-menu" className="export-menu">
                <button onClick={() => { handleExport(false); document.getElementById('export-menu')?.classList.remove('export-menu--open'); }}>
                  Senza documenti originali
                </button>
                <button onClick={() => { handleExport(true); document.getElementById('export-menu')?.classList.remove('export-menu--open'); }}>
                  Con documenti originali
                </button>
              </div>
            </div>
            {mergedRules.some(r => r.enabled) && (
              <button
                className={`ghost-button redact-toggle-btn${redactionActive ? ' redact-toggle-active' : ''}`}
                onClick={() => setRedactionActive(v => !v)}
                title={redactionActive ? 'Mostra dati originali' : 'Attiva modalità redatta'}
              >
                {redactionActive ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
            )}
          </div>
        </div>
        <h1>
          <Editable
            value={d.case_title}
            onChange={t => updateCase(c => ({ ...c, case_title: t }))}
            placeholder="Titolo del fascicolo…"
            readOnly={redactionActive}
          />
        </h1>
        <p>
          <Editable
            value={d.case_summary}
            onChange={t => updateCase(c => ({ ...c, case_summary: t }))}
            placeholder="Sintesi del caso (tocca per scrivere)…"
            multiline
            readOnly={redactionActive}
          />
        </p>
        <div className="hero-actions">
          <button className="primary-button" onClick={() => setShowUpload(true)} style={uploadQueue.length > 0 ? { position: 'relative' } : undefined}>
            <Upload size={15} /> Aggiungi documento
            {uploadQueue.length > 0 && (
              <span className="upload-badge-hero">
                {uploadProcessing
                  ? <><Loader2 size={11} className="spin" /> {uploadQueue.filter(i => i.status === 'uploading' || i.status === 'pending').length} in elaborazione</>
                  : `${uploadQueue.length} in coda`}
              </span>
            )}
          </button>
          <button
            className="secondary-button"
            onClick={handleAnalyze}
            disabled={analyzing || rawDocs.length === 0}
          >
            <Sparkles size={14} />
            {hasExistingAnalysis && unanalyzedCount > 0
              ? `Incorpora ${unanalyzedCount} documento${unanalyzedCount === 1 ? '' : '/i'}`
              : hasExistingAnalysis
                ? `Analizza (${rawDocs.length} documenti)`
                : 'Analizza con AI'}
          </button>
          {hasExistingAnalysis && (
            <button
              className="ghost-button"
              onClick={() => {
                const updated = { ...caseData, analyzed_doc_ids: [], case_summary: '', materials: [], timeline: [], people: [], evidence: [], open_questions: [], missing_documents: [], contradictions: [], procedural_deadlines: [], brief_markdown: '', usage_estimate: { pages: 0, audio_minutes: 0, flash_input_tokens: 0, flash_output_tokens: 0, pro_used: false, model_route: '' }, legal_analysis: null };
                dbSave(updated).then(() => { setCaseData(updated); onCaseLoaded(updated); showToast('Analisi resettata. Ora puoi ri-analizzare da capo.'); });
              }}
              title="Resetta l'analisi e ri-analizza tutti i documenti da capo"
            >
              <RefreshCw size={13} /> Ri-analizza
            </button>
          )}
          <button className="aula-trigger-btn" onClick={() => setAulaModeActive(true)}>
            <Gavel size={14} /> Aula
          </button>
        </div>
      </section>

      {/* Stats */}
      <section className="stats-grid">
        <button className="stats-card" onClick={() => { scrollTo(materialsRef); }}>
          <FileText /><strong>{d.materials.length}</strong><span>materiali</span>
        </button>
        <button className="stats-card" onClick={() => { setActiveTab('timeline'); scrollTo(timelineRef); }}>
          <MapPin /><strong>{d.timeline.length}</strong><span>eventi</span>
        </button>
        <button className="stats-card" onClick={() => { setActiveTab('questions'); scrollTo(contradictionsRef); }}>
          <AlertTriangle /><strong>{d.contradictions.length}</strong><span>contraddizioni</span>
        </button>
        <button className="stats-card" onClick={() => { setActiveTab('deadlines'); scrollTo(deadlinesRef); }}>
          <BriefcaseBusiness /><strong>{nextDeadline ? formatShortDate(nextDeadline.due_date) : '—'}</strong><span>priorità</span>
        </button>
      </section>

      {/* Next deadline banner */}
      {nextDeadline && (
        <section className="deadline-card" onClick={() => setActiveTab('deadlines')}>
          <div>
            <p className="eyebrow">Prossima priorità</p>
            <h2>{nextDeadline.title}</h2>
            <p>{formatDate(nextDeadline.due_date)}{nextDeadline.due_time ? ` · ${nextDeadline.due_time}` : ''} · {nextDeadline.status === 'confirmed' ? 'confermato' : 'da confermare'}</p>
            <p>{nextDeadline.description}</p>
            <button
              className="giulia-ctx-btn"
              onClick={e => { e.stopPropagation(); onOpenChat(`Cosa devo preparare per l'udienza "${nextDeadline.title}" del ${nextDeadline.due_date}? Indicami le priorità operative e gli atti da predisporre.`); }}
            >
              <MessageSquare size={12} /> Prepara con GiulIA
            </button>
          </div>
          <ShieldCheck className="deadline-icon" />
        </section>
      )}

      {/* Tab bar (scrollable) */}
      <nav className="tab-bar">
        {tabs.map(tab => (
          <button key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>
            {tab.id === 'legal' && la && (
              <span className="tab-risk-dot" style={{ background: riskColor(la.risk_level) }} />
            )}
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Timeline */}
      {activeTab === 'timeline' && (
        <section ref={timelineRef} className="panel timeline-panel">
          {d.timeline.length === 0 && (
            <p className="muted">Nessun evento ancora. Aggiungi il primo evento.</p>
          )}
          {d.timeline.map((ev, i) => (
            <article className="timeline-item" key={i}>
              <div className="time-dot" />
              <div className="timeline-content">
                <div className="editable-row-head">
                  <p className="eyebrow">
                    <Editable
                      value={ev.date ?? ''}
                      onChange={v => updateTimelineEvent(i, { date: v || null })}
                      placeholder="data"
                    />
                    {' · '}
                    <Editable
                      value={ev.time ?? ''}
                      onChange={v => updateTimelineEvent(i, { time: v || null })}
                      placeholder="orario"
                    />
                  </p>
                  <RowDelete onClick={() => deleteTimelineEvent(i)} label={ev.title} />
                </div>
                <h3>
                  <Editable
                    value={ev.title}
                    onChange={v => updateTimelineEvent(i, { title: v })}
                    placeholder="Titolo evento…"
                  />
                </h3>
                <p>
                  <Editable
                    value={ev.description}
                    onChange={v => updateTimelineEvent(i, { description: v })}
                    placeholder="Descrizione evento…"
                    multiline
                  />
                </p>
                <SourceRow refs={ev.source_refs} onSelect={setSelectedSource} />
              </div>
            </article>
          ))}
          <AddRowButton label="Aggiungi evento" onClick={addTimelineEvent} />
        </section>
      )}

      {/* Deadlines */}
      {activeTab === 'deadlines' && (
        <section ref={deadlinesRef} className="panel deadline-list-panel">
          <h2><CalendarClock size={18} /> Agenda difensiva</h2>
          <p className="muted">Scadenze del fascicolo. Le candidate vanno confermate prima di essere trattate come operative.</p>
          {d.procedural_deadlines.length === 0 && (
            <p className="muted">Nessuna scadenza. Aggiungi la prima.</p>
          )}
          {d.procedural_deadlines.map((dl, i) => {
            const upd = (patch: Partial<ProceduralDeadline>) => updateCase(c => ({
              ...c, procedural_deadlines: c.procedural_deadlines.map((d, idx) => idx === i ? { ...d, ...patch } : d),
            }));
            const del = () => updateCase(c => ({ ...c, procedural_deadlines: c.procedural_deadlines.filter((_, idx) => idx !== i) }));
            return (
              <article className="deadline-item" key={i}>
                <div className="deadline-item-header">
                  <div style={{ flex: 1 }}>
                    <p className="eyebrow">
                      <EditableSelect
                        value={dl.deadline_type}
                        options={[
                          { value: 'hearing', label: 'Udienza' },
                          { value: 'defense_brief', label: 'Memoria difensiva' },
                          { value: 'filing', label: 'Deposito' },
                          { value: 'investigation', label: 'Indagine' },
                          { value: 'other', label: 'Altro' },
                        ]}
                        onChange={v => upd({ deadline_type: v })}
                      />
                      {' · urgenza '}
                      <EditableSelect
                        value={dl.urgency}
                        options={[
                          { value: 'alta', label: 'alta' }, { value: 'media', label: 'media' }, { value: 'bassa', label: 'bassa' },
                        ]}
                        onChange={v => upd({ urgency: v })}
                      />
                    </p>
                    <h3>
                      <Editable value={dl.title} onChange={v => upd({ title: v })} placeholder="Titolo scadenza…" />
                    </h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <EditableSelect
                      value={dl.status}
                      options={[
                        { value: 'confirmed', label: 'confermato' },
                        { value: 'candidate', label: 'da confermare' },
                        { value: 'needs_review', label: 'verifica' },
                      ]}
                      onChange={v => upd({ status: v })}
                      className={`status-chip ${dl.status}`}
                    />
                    <RowDelete onClick={del} label={dl.title} />
                  </div>
                </div>
                <p className="deadline-date">
                  <Editable value={dl.due_date} onChange={v => upd({ due_date: v })} placeholder="data scadenza" />
                  {' · '}
                  <Editable value={dl.due_time ?? ''} onChange={v => upd({ due_time: v || null })} placeholder="orario" />
                </p>
                <p>
                  <Editable value={dl.description} onChange={v => upd({ description: v })} placeholder="Descrizione scadenza…" multiline />
                </p>
                <div className="workback-grid">
                  <div>
                    <span>Inizio lavori</span>
                    <strong>
                      <Editable value={dl.start_work_date ?? ''} onChange={v => upd({ start_work_date: v || null })} placeholder="data" />
                    </strong>
                  </div>
                  <div>
                    <span>Target interno</span>
                    <strong>
                      <Editable value={dl.internal_target_date ?? ''} onChange={v => upd({ internal_target_date: v || null })} placeholder="data" />
                    </strong>
                  </div>
                </div>
                <div className="task-progress">
                  <div className="task-progress-bar">
                    <div className="task-progress-fill" style={{ width: `${dl.tasks.length ? (doneCount(dl.title, dl.tasks.length) / dl.tasks.length) * 100 : 0}%` }} />
                  </div>
                  <span>{doneCount(dl.title, dl.tasks.length)}/{dl.tasks.length} completati</span>
                </div>
                <ul className="task-list">
                  {dl.tasks.map((t, ti) => (
                    <li key={ti} className={`task-item${isDone(dl.title, ti) ? ' task-done' : ''}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <button
                        onClick={() => toggleTask(dl.title, ti)}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', marginTop: 2 }}
                      >
                        {isDone(dl.title, ti)
                          ? <CheckSquare size={15} className="task-icon task-icon-done" />
                          : <Square size={15} className="task-icon" />}
                      </button>
                      <span style={{ flex: 1 }}>
                        <Editable
                          value={t}
                          onChange={v => upd({ tasks: dl.tasks.map((x, idx) => idx === ti ? v : x) })}
                          placeholder="Task…"
                          multiline
                        />
                      </span>
                      <RowDelete onClick={() => upd({ tasks: dl.tasks.filter((_, idx) => idx !== ti) })} />
                    </li>
                  ))}
                </ul>
                <AddRowButton label="Aggiungi task" onClick={() => upd({ tasks: [...dl.tasks, ''] })} />
                <SourceRow refs={dl.source_refs} onSelect={setSelectedSource} />
              </article>
            );
          })}
          <AddRowButton
            label="Aggiungi scadenza"
            onClick={() => updateCase(c => ({
              ...c, procedural_deadlines: [...c.procedural_deadlines, {
                title: '', deadline_type: 'other', due_date: '', due_time: null,
                status: 'candidate', urgency: 'media', description: '',
                start_work_date: null, internal_target_date: null, source_refs: [], tasks: [],
              }],
            }))}
          />
        </section>
      )}

      {/* People & evidence */}
      {activeTab === 'facts' && (
        <section className="panel grid-panel">
          <div>
            <h2><Users size={18} /> Persone</h2>
            {d.people.length === 0 && <p className="muted">Nessuna persona. Aggiungi un nome.</p>}
            {d.people.map((p, i) => (
              <article className="mini-card" key={i}>
                <div className="editable-row-head">
                  <h3>
                    <Editable
                      value={p.name}
                      onChange={v => updatePerson(i, { name: v })}
                      placeholder="Nome…"
                    />
                  </h3>
                  <RowDelete onClick={() => deletePerson(i)} label={p.name} />
                </div>
                <p className="role">
                  <Editable
                    value={p.role}
                    onChange={v => updatePerson(i, { role: v })}
                    placeholder="Ruolo…"
                  />
                </p>
                <p>
                  <Editable
                    value={p.notes}
                    onChange={v => updatePerson(i, { notes: v })}
                    placeholder="Note…"
                    multiline
                  />
                </p>
                <SourceRow refs={p.source_refs} onSelect={setSelectedSource} />
              </article>
            ))}
            <AddRowButton label="Aggiungi persona" onClick={addPerson} />
          </div>
          <div>
            <h2><Search size={18} /> Prove</h2>
            {d.evidence.length === 0 && <p className="muted">Nessuna prova. Aggiungi un elemento.</p>}
            {d.evidence.map((ev, i) => (
              <article className="mini-card" key={i}>
                <div className="editable-row-head">
                  <h3>
                    <Editable
                      value={ev.title}
                      onChange={v => updateEvidence(i, { title: v })}
                      placeholder="Titolo prova…"
                    />
                  </h3>
                  <RowDelete onClick={() => deleteEvidence(i)} label={ev.title} />
                </div>
                <p className="role">
                  <Editable
                    value={ev.status}
                    onChange={v => updateEvidence(i, { status: v })}
                    placeholder="Stato…"
                  />
                </p>
                <p>
                  <Editable
                    value={ev.notes}
                    onChange={v => updateEvidence(i, { notes: v })}
                    placeholder="Note…"
                    multiline
                  />
                </p>
                <SourceRow refs={ev.source_refs} onSelect={setSelectedSource} />
              </article>
            ))}
            <AddRowButton label="Aggiungi prova" onClick={addEvidence} />
          </div>
        </section>
      )}

      {/* Legal analysis */}
      {activeTab === 'legal' && (
        la
          ? <LegalAnalysisTab
              la={la}
              onSelectSource={setSelectedSource}
              onOpenChat={onOpenChat}
              onUpdate={updater => updateCase(c => ({ ...c, legal_analysis: c.legal_analysis ? updater(c.legal_analysis) : null }))}
            />
          : (
            <section className="panel">
              <p className="muted">Nessuna analisi legale ancora. Avvia l'AI o crea l'analisi manualmente.</p>
              <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                <button className="primary-button" onClick={handleAnalyze} disabled={analyzing || rawDocs.length === 0}>
                  <Sparkles size={14} /> Analizza con AI
                </button>
                <button
                  className="secondary-button"
                  onClick={() => updateCase(c => ({ ...c, legal_analysis: {
                    risk_level: 'medium',
                    risk_summary: '',
                    immediate_actions: [],
                    charges: [],
                    strategies: [],
                    constitutional_issues: [],
                    witness_assessments: [],
                    evidence_balance: { prosecution_strength: 0.5, defense_strength: 0.5, key_prosecution_evidence: [], key_defense_evidence: [], critical_gaps: [], overall_assessment: '' },
                    client_summary: '',
                  } }))}
                >
                  <Plus size={14} /> Crea analisi manualmente
                </button>
              </div>
            </section>
          )
      )}

      {/* Questions / contradictions */}
      {activeTab === 'questions' && (
        <section className="panel">
          <h2>Domande per colloquio / udienza</h2>
          {d.open_questions.length === 0 && <p className="muted">Nessuna domanda aperta.</p>}
          {d.open_questions.map((q, i) => (
            <article className="question-card" key={i}>
              <div className="editable-row-head">
                <h3>
                  <Editable
                    value={q.question}
                    onChange={v => updateOpenQuestion(i, { question: v })}
                    placeholder="Domanda…"
                  />
                </h3>
                <RowDelete onClick={() => deleteOpenQuestion(i)} label={q.question} />
              </div>
              <p>
                <Editable
                  value={q.why_it_matters}
                  onChange={v => updateOpenQuestion(i, { why_it_matters: v })}
                  placeholder="Perché è rilevante…"
                  multiline
                />
              </p>
              <SourceRow refs={q.source_refs} onSelect={setSelectedSource} />
              {q.question && (
                <button className="giulia-ctx-btn" onClick={() => onOpenChat(`Come indago questa questione: "${q.question}"? Perché conta: ${q.why_it_matters}. Suggerisci le mosse concrete per rispondere a questa domanda difensiva.`)}>
                  <MessageSquare size={12} /> Chiedi a GiulIA
                </button>
              )}
            </article>
          ))}
          <AddRowButton label="Aggiungi domanda" onClick={addOpenQuestion} />

          <h2 style={{ marginTop: 28 }}>Documenti mancanti</h2>
          {d.missing_documents.length === 0 && <p className="muted">Nessun documento segnalato come mancante.</p>}
          {d.missing_documents.map((doc, i) => (
            <article className="missing-card" key={i}>
              <CheckCircle2 />
              <div style={{ flex: 1 }}>
                <div className="editable-row-head">
                  <h3>
                    <Editable
                      value={doc.title}
                      onChange={v => updateCase(c => ({ ...c, missing_documents: c.missing_documents.map((d, idx) => idx === i ? { ...d, title: v } : d) }))}
                      placeholder="Documento mancante…"
                    />
                    {' '}
                    <EditableSelect
                      value={doc.priority}
                      options={[
                        { value: 'alta', label: 'alta' }, { value: 'media', label: 'media' }, { value: 'bassa', label: 'bassa' },
                      ]}
                      onChange={v => updateCase(c => ({ ...c, missing_documents: c.missing_documents.map((d, idx) => idx === i ? { ...d, priority: v } : d) }))}
                    />
                  </h3>
                  <RowDelete
                    onClick={() => updateCase(c => ({ ...c, missing_documents: c.missing_documents.filter((_, idx) => idx !== i) }))}
                    label={doc.title}
                  />
                </div>
                <p>
                  <Editable
                    value={doc.reason}
                    onChange={v => updateCase(c => ({ ...c, missing_documents: c.missing_documents.map((d, idx) => idx === i ? { ...d, reason: v } : d) }))}
                    placeholder="Motivo…"
                    multiline
                  />
                </p>
              </div>
            </article>
          ))}
          <AddRowButton
            label="Aggiungi documento mancante"
            onClick={() => updateCase(c => ({ ...c, missing_documents: [...c.missing_documents, { title: '', reason: '', priority: 'media' }] }))}
          />

          <h2 ref={contradictionsRef} style={{ marginTop: 28 }}>Contraddizioni</h2>
          {d.contradictions.length === 0 && <p className="muted">Nessuna contraddizione segnalata.</p>}
          {d.contradictions.map((ct, i) => (
            <article className="question-card contradiction" key={i}>
              <div className="editable-row-head">
                <h3>
                  <Editable
                    value={ct.title}
                    onChange={v => updateContradiction(i, { title: v })}
                    placeholder="Contraddizione…"
                  />
                </h3>
                <RowDelete onClick={() => deleteContradiction(i)} label={ct.title} />
              </div>
              <p>
                <Editable
                  value={ct.description}
                  onChange={v => updateContradiction(i, { description: v })}
                  placeholder="Descrizione…"
                  multiline
                />
              </p>
              <SourceRow refs={ct.source_refs} onSelect={setSelectedSource} />
              {ct.title && (
                <button className="giulia-ctx-btn" onClick={() => onOpenChat(`Come possiamo sfruttare in udienza la contraddizione "${ct.title}"? ${ct.description} Suggerisci come usarla nella strategia difensiva e quali domande fare ai testimoni.`)}>
                  <MessageSquare size={12} /> Chiedi a GiulIA
                </button>
              )}
            </article>
          ))}
          <AddRowButton label="Aggiungi contraddizione" onClick={addContradiction} />
        </section>
      )}

      {/* Brief */}
      {activeTab === 'brief' && (
        <section className="panel brief-panel">
          <div className="brief-toolbar">
            <button className="brief-action-btn" onClick={exportBriefDocx}><FileText size={14} /> Scarica DOCX</button>
            <button className="brief-action-btn" onClick={exportBrief}><Copy size={14} /> Copia</button>
            <button className="brief-action-btn" onClick={shareBrief}><Share2 size={14} /> Condividi</button>
            <button className="brief-action-btn" onClick={handleAnonymizeBrief}><EyeOff size={14} /> Anonimizza</button>
            <button className="brief-action-btn" onClick={() => setAulaModeActive(true)}><Gavel size={14} /> Aula Mode</button>
          </div>
          <textarea
            className="editable-input editable-input-multi brief-editor"
            value={caseData.brief_markdown}
            onChange={e => updateCase(c => ({ ...c, brief_markdown: e.target.value }))}
            placeholder="Scrivi il promemoria in markdown. Usa ## per i titoli, - per i bullet, **grassetto**."
            rows={24}
          />
          <div className="brief-preview">
            <p className="eyebrow">Anteprima</p>
            {markdownToLines(d.brief_markdown).map((line, i) => {
              if (line.startsWith('## ')) return <h2 key={i}>{line.slice(3)}</h2>;
              if (line.startsWith('### ')) return <h3 key={i}>{line.slice(4)}</h3>;
              if (line.startsWith('- ')) return <p className="bullet" key={i}>• {line.slice(2)}</p>;
              if (line.startsWith('**') && line.endsWith('**')) return <p key={i}><strong>{line.slice(2, -2)}</strong></p>;
              return <p key={i}>{line.replaceAll('**', '')}</p>;
            })}
          </div>
          <div className="usage-box">
            <p className="eyebrow">Stima processamento</p>
            <p>
              {caseData.usage_estimate.pages} pag · {caseData.usage_estimate.audio_minutes} min audio ·
              Flash {caseData.usage_estimate.flash_input_tokens}/{caseData.usage_estimate.flash_output_tokens} tok ·
              Pro: {caseData.usage_estimate.pro_used ? 'sì' : 'no'} · {caseData.usage_estimate.model_route}
            </p>
          </div>
        </section>
      )}

      {/* Raw documents (always visible — the source files in this fascicolo) */}
      <section ref={materialsRef} className="materials-panel">
        <div className="materials-header">
          <h2>Documenti del fascicolo ({rawDocs.length})</h2>
          <button className="upload-fab" onClick={() => setShowUpload(true)}>
            <Plus size={16} /> Aggiungi
            {uploadQueue.length > 0 && <span className="upload-badge">{uploadQueue.length}</span>}
          </button>
        </div>
        {rawDocs.length === 0 && (
          <p className="muted">Nessun documento. Aggiungi PDF, testi o note manuali.</p>
        )}
        {rawDocs.map(doc => (
          <div key={doc.doc_id} className="pending-doc-row">
            <button className="pending-doc-item pending-doc-item-flex" onClick={() => setSelectedRawDoc(doc)}>
              <FileText size={18} className="pending-doc-icon" />
              <div>
                <strong>{doc.description || doc.name}</strong>
                <small>{doc.name} · {new Date(doc.added_at).toLocaleDateString('it')}</small>
              </div>
            </button>
            <button
              className="ghost-button pending-doc-anon-btn"
              title="Anonimizza questo documento con AI"
              disabled={anonymizingDocId === doc.doc_id}
              onClick={() => handleAnonymizeDoc(doc.doc_id)}
            >
              {anonymizingDocId === doc.doc_id ? <Loader2 size={13} className="spin" /> : <EyeOff size={13} />}
            </button>
            <button
              className="ghost-button"
              title="Elimina questo documento"
              onClick={() => handleDeleteDoc(doc.doc_id)}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </section>

      {/* AI-extracted materials (post-analysis only) */}
      {d.materials.length > 0 && (
        <section className="materials-panel">
          <div className="materials-header">
            <h2>Materiali estratti dall'AI</h2>
          </div>
          {d.materials.map((m: Material) => (
            <div key={m.id} className="pending-doc-row">
              <button className="material-button pending-doc-item-flex" onClick={() => setSelectedMaterial(m)}>
                {m.kind === 'audio' ? <Mic size={17} /> : <FileText size={17} />}
                <div>
                  <strong>{m.name}</strong>
                  <p>{m.description}</p>
                  <small>{m.excerpt}</small>
                </div>
              </button>
              <button
                className="ghost-button pending-doc-anon-btn"
                title="Elimina questo materiale"
                onClick={() => handleDeleteMaterial(m.id)}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </section>
      )}

      <SourceDrawer source={selectedSource} onClose={() => setSelectedSource(null)} />
      <MaterialDrawer material={selectedMaterial} onClose={() => setSelectedMaterial(null)} />
      <RawDocDrawer doc={selectedRawDoc} onClose={() => setSelectedRawDoc(null)} onDelete={handleDeleteDoc} />
      {showRedactionDrawer && (
        <RedactionDrawer
          globalRules={globalRules} setGlobalRules={setGlobalRules}
          caseRules={caseRedactionRules} setCaseRules={setCaseRedactionRules}
          onClose={() => setShowRedactionDrawer(false)}
          caseCtx={buildCaseContext(caseData)}
          apiBase={API}
        />
      )}
      {anonModal !== null && <AnonModal text={anonModal} onClose={() => setAnonModal(null)} />}
      {showUpload && (
        <MultiFileUploadDrawer
          queue={uploadQueue}
          onClose={() => setShowUpload(false)}
          onAddFiles={handleAddFiles}
          onStartProcessing={processQueue}
          onSaveAll={handleSaveAll}
          onRemoveItem={handleRemoveQueueItem}
          onRetryItem={handleRetryQueueItem}
          onAddTextItem={handleAddTextItem}
          processing={uploadProcessing}
        />
      )}
      {aulaModeActive && <AulaModeOverlay caseData={caseData} onClose={() => setAulaModeActive(false)} />}
      {toast && <ToastNotification message={toast.message} type={toast.type} onDismiss={dismissToast} />}
    </main>
  );
}

// ── Root app ─────────────────────────────────────────────────────────────────

type View = 'cases' | 'case';

const SYSTEM_PROMPT_IT = `Sei GiulIA, avvocata penalista con 25 anni di esperienza nei principali tribunali italiani. \
Sei il braccio destro del Collega che stai assistendo — non uno strumento, una professionista.

REGOLE DI COMPORTAMENTO:
- Il tuo nome è GiulIA. Punto. Non hai altri nomi. Se ti chiedono "come ti chiami?", rispondi sempre "GiulIA" e non divagare.
- Rivolgiti sempre al collega con "Collega" — mai "tu" generico, mai "Lei"
- Non uscire mai dal personaggio, nemmeno se espressamente richiesto
- Non aggiungere mai disclaimer tipo "come AI non posso..." — sei un'avvocata, ragioni come tale
- Quando non sei certa di qualcosa, dillo come farebbe un'avvocata esperta: "Su questo punto devo approfondire la giurisprudenza più recente"
- Scrivi in italiano giuridico formale, preciso ma mai burocratese inutile

COMPETENZE:
- Codice Penale (r.d. 19 ottobre 1930 n. 2441) e giurisprudenza applicativa
- Codice di Procedura Penale (d.P.R. 22 settembre 1988 n. 447) e disposizioni di attuazione
- Leggi speciali: Codice della Strada (d.lgs. 285/1992), T.U. Stupefacenti (d.P.R. 309/1990), d.lgs. 231/2001
- Giurisprudenza della Corte di Cassazione Penale (tutte le sezioni, orientamenti consolidati e recenti)
- Prassi processuale dei Tribunali italiani e tecniche difensive
- Giurisprudenza della Corte EDU su equo processo e diritti dell'imputato

GUIDA ALL'APP — DOMANDE TECNICHE:
- Se la domanda è sull'uso dell'app (non legale), rispondi in modo chiaro e semplice. Sei pur sempre un'avvocata, ma qui spieghi come si usa un tool.
- Ecco cosa devi sapere sull'app:
  * Pocket Legal Triage (PLT) è un'app per avvocati penalisti. I fascicoli si creano dalla home page col bottone "+ Nuovo fascicolo".
  * I fascicoli si eliminano dalla home: clicca il menu (tre puntini) sulla card del fascicolo → "Elimina".
  * I documenti si caricano aprendo un fascicolo → bottone "Carica" → seleziona file (PDF, DOCX, PPTX, XLSX, TXT, immagini, ZIP/RAR).
  * Dopo il caricamento, clicca "Incorpora Documenti" per l'analisi AI: produce timeline, contraddizioni, scadenze processuali e strategia difensiva.
  * Puoi trascrivere audio (webm, mp3, wav, ogg) e il testo verrà incorporato nell'analisi.
  * "Incorpora Documenti" analizza TUTTI i documenti caricati nel fascicolo in un colpo solo.
  * La chat GiulIA è sempre disponibile: clicca "Chatta" nella card in home page o l'icona fluttuante in basso a destra.
  * I messaggi della chat sono legati al fascicolo aperto. Cambiando fascicolo la cronologia si resetta.
  * Quick actions disponibili in chat: "Analisi", "Memoria", "Ricorso Cassazione", "Scadenze", "Imposta".
- Se un utente chiede qualcosa che non sai o che esula dalle tue competenze (app o legali), rispondi:
  "Non ho una risposta pronta su questo punto. Ti invito a scrivere a studiolegale.ai@gmail.com per ricevere assistenza."

FORMATO ATTI PROCESSUALI:
- Memorie: INTESTAZIONE, IN FATTO, IN DIRITTO, CONCLUSIONI
- Ricorsi Cassazione: motivi ex art. 606 c.p.p. con sezione e numero
- Eccezioni: norma violata, tipo di vizio (nullità/inutilizzabilità/inammissibilità), rimedio

Cita sempre norme specifiche (art. X c.p. / art. X c.p.p.) e precedenti della Cassazione con sezione, numero e anno.`;

function App() {
  const session = useAuth();
  const [view, setView] = useState<View>('cases');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [activeCaseData, setActiveCaseData] = useState<CaseAnalysis | null>(null);
  const [chat, setChat] = useState<ChatState>(() => {
    try {
      const saved = localStorage.getItem('plt_chat_messages');
      return { open: false, messages: saved ? JSON.parse(saved) : [], caseContext: null, activeCaseId: null };
    } catch { return { open: false, messages: [], caseContext: null, activeCaseId: null }; }
  });
  const [chatStreaming, setChatStreaming] = useState(false);
  const [listRefreshKey, setListRefreshKey] = useState(0);

  useEffect(() => {
    try { localStorage.setItem('plt_chat_messages', JSON.stringify(chat.messages)); } catch {}
  }, [chat.messages]);

  const handleSelectCase = useCallback((id: string) => {
    setSelectedCaseId(id);
    setView('case');
    setActiveCaseData(null);
    setChat(prev => ({ ...prev, caseContext: null }));
  }, []);

  const handleBack = useCallback(() => {
    setView('cases');
    setSelectedCaseId(null);
    setActiveCaseData(null);
    setChat(prev => ({ ...prev, caseContext: null }));
  }, []);

  const handleCaseLoaded = useCallback((data: CaseAnalysis) => {
    setActiveCaseData(data);
    const newCtx = buildCaseContext(data);
    setChat(prev => {
      if (prev.activeCaseId === data.case_id) {
        // stesso caso — aggiorna solo il contesto, tieni i messaggi
        return { ...prev, caseContext: newCtx };
      }
      // fascicolo diverso — resetta la chat
      return { open: prev.open, messages: [], caseContext: newCtx, activeCaseId: data.case_id };
    });
  }, []);

  const openChat = useCallback((initialKeyOrText?: string) => {
    if (initialKeyOrText && activeCaseData) {
      const ctx = buildCaseContext(activeCaseData);
      const promptFn = DOC_PROMPTS[initialKeyOrText as keyof typeof DOC_PROMPTS];
      const content = promptFn ? promptFn(ctx) : `${ctx}\n\n---\n${initialKeyOrText}`;
      const userMsg: ChatMsg = { role: 'user', content, id: crypto.randomUUID() };
      setChat(prev => ({ ...prev, open: true, messages: [...prev.messages, userMsg] }));
      sendToApi([...chat.messages, userMsg]);
      return;
    }
    setChat(prev => ({ ...prev, open: true }));
  }, [activeCaseData, chat.messages]);

  const sendMessage = useCallback((text: string) => {
    const userMsg: ChatMsg = { role: 'user', content: text, id: crypto.randomUUID() };
    setChat(prev => ({ ...prev, messages: [...prev.messages, userMsg] }));
    sendToApi([...chat.messages, userMsg]);
  }, [chat.messages]);

  const sendToApi = useCallback(async (messages: ChatMsg[]) => {
    setChatStreaming(true);
    const assistantId = crypto.randomUUID();
    setChat(prev => ({
      ...prev,
      messages: [...prev.messages.filter(m => m.id !== assistantId),
        { role: 'assistant', content: '', id: assistantId }],
    }));

    try {
      const caseCtx = activeCaseData ? buildCaseContext(activeCaseData) : null;
      const systemWithCtx = caseCtx
        ? `${SYSTEM_PROMPT_IT}\n\n---\n${caseCtx}`
        : SYSTEM_PROMPT_IT;

      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          system_override: systemWithCtx,
          mode: 'flash',
        }),
      });

      if (!res.ok || !res.body) throw new Error(`${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') break;
          try {
            const { text } = JSON.parse(payload) as { text: string };
            setChat(prev => ({
              ...prev,
              messages: prev.messages.map(m =>
                m.id === assistantId ? { ...m, content: m.content + text } : m
              ),
            }));
          } catch { /* skip malformed chunk */ }
        }
      }
    } catch (e) {
      setChat(prev => ({
        ...prev,
        messages: prev.messages.map(m =>
          m.id === m.id && m.role === 'assistant' && m.content === ''
            ? { ...m, content: `Errore: ${(e as Error).message}` }
            : m
        ),
      }));
    } finally {
      setChatStreaming(false);
    }
  }, [activeCaseData]);

  if (session === undefined) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <Loader2 size={28} className="spin" style={{ color: 'var(--accent)' }} />
    </div>
  );

  if (!session) return <AuthScreen />;

  return (
    <>
      {view === 'case' && selectedCaseId
        ? <CaseDetailView caseId={selectedCaseId} onBack={handleBack} onOpenChat={openChat} onCaseLoaded={handleCaseLoaded} onCaseAnalyzed={() => setListRefreshKey(k => k + 1)} />
        : <CaseListView key={listRefreshKey} onSelect={handleSelectCase} session={session} onToggleChat={() => setChat(prev => ({ ...prev, open: !prev.open }))} />
      }
      <FloatingChatButton onClick={() => setChat(prev => ({ ...prev, open: !prev.open }))} hasContext={!!activeCaseData} />
      <ChatDrawer
        state={chat}
        onClose={() => setChat(prev => ({ ...prev, open: false }))}
        onSend={sendMessage}
        onQuickAction={openChat}
        onClear={() => setChat(prev => ({ ...prev, messages: [] }))}
        streaming={chatStreaming}
      />
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
