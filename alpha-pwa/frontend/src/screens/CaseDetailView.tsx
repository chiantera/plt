import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, ArrowRight, BookOpen,
  CalendarClock, CheckCircle2, CheckSquare, ChevronDown, ChevronRight,
  Clock, Copy, Eye, EyeOff, FileText, Gavel, Loader2, MessageSquare, Mic, Plus, RefreshCw,
  Scale, Search, Share2, ShieldAlert, ShieldCheck, ShieldOff, Sparkles,
  Square, Trash2, Upload, Users, X, Zap,
} from 'lucide-react';
import { type Session } from '@supabase/supabase-js';
import { API } from '../config';
import { formatDate, formatDateFull, formatShortDate } from '../dateUtils';
import { dbGet, dbSave, localOwnerIdFromSession } from '../db';
import { exportEncryptedPlt, exportPlainPlt } from '../pltExport';
import {
  addDraftArtifact,
  buildDraftPrompt,
  createDraftArtifact,
  DRAFT_PLAINTEXT_EXPORT_WARNING,
  draftTypeLabel,
  exportDraftArtifact,
  flagUnverifiedCassationCitations,
  updateDraftArtifact,
  type DraftArtifact,
  type DraftArtifactType,
} from '../draftArtifacts';
import { DOC_PROMPTS } from '../prompts/documentDrafts';
import { REDACT_APPLY_PROMPT, REDACT_DETECT_PROMPT } from '../prompts/redaction';
import { buildCaseContext } from '../domain/caseContext';
import { buildUserContextMaterial, mergeWithAi } from '../domain/caseMerge';
import { applyRedactionToCase, mergeRedactionRules } from '../domain/redaction';
import { riskColor, riskIcon, riskLabel } from '../domain/helpers';
import type {
  CaseAnalysis,
  ChargeAnalysis,
  ChargeElement,
  ConstitutionalIssue,
  Contradiction,
  DefenseStrategy,
  EvidenceBalance,
  EvidenceItem,
  LegalAnalysis,
  Material,
  OpenQuestion,
  Person,
  ProceduralDeadline,
  RawDocument,
  RedactionRule,
  SourceRef,
  TabId,
  TimelineEvent,
  UploadQueueItem,
  UserProfile,
  WitnessAssessment,
} from '../domain/types';
import GiuliaPromptBar from '../components/GiuliaPromptBar';

const MultiFileUploadDrawer = React.lazy(() => import('../components/MultiFileUploadDrawer'));

// ── Helpers ──────────────────────────────────────────────────────────────────

function pct(v: number) { return `${Math.round(v * 100)}%`; }

function deadlineTypeLabel(t: ProceduralDeadline['deadline_type']) {
  return ({ hearing: 'udienza', defense_brief: 'memoria difensiva', filing: 'deposito', investigation: 'indagine difensiva', other: 'altro' })[t];
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
    <button className="source-badge" title="Visualizza il documento sorgente" onClick={() => onSelect(refItem)}>
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
    <button title="Aggiungi nuova riga" className="add-row-btn" onClick={onClick}>
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
          <button onClick={onClose} className="ghost-button" title="Chiudi la finestra corrente">Chiudi</button>
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
          <button onClick={onClose} className="ghost-button" title="Chiudi la finestra corrente">Chiudi</button>
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
            <button title="Esegui azione" onClick={() => { onDelete(doc.doc_id); onClose(); }} className="ghost-button" style={{ color: 'var(--critical)' }}><Trash2 size={16} /></button>
            <button onClick={onClose} className="ghost-button" title="Chiudi la finestra corrente">Chiudi</button>
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
        <button title="Chiudi o annulla" className="aula-close" onClick={onClose}><X size={19} /></button>
      </div>

      <div className="aula-dots">
        {Array.from({ length: AULA_SLIDES }, (_, i) => (
          <button title="Esegui azione" key={i} className={`aula-dot${slide === i ? ' active' : ''}`} onClick={() => setSlide(i)} />
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
        <button title="Scorri diapositive" className="aula-nav-btn" onClick={() => setSlide(s => Math.max(s - 1, 0))} disabled={slide === 0}>
          <ArrowLeft size={22} />
        </button>
        <span className="aula-nav-counter">{slide + 1} / {AULA_SLIDES}</span>
        <button title="Scorri diapositive" className="aula-nav-btn" onClick={() => setSlide(s => Math.min(s + 1, AULA_SLIDES - 1))} disabled={slide === AULA_SLIDES - 1}>
          <ArrowRight size={22} />
        </button>
      </div>
    </div>
  );
}
// ── Legal analysis tab ────────────────────────────────────────────────────────


function LegalAnalysisTab({ la, onSelectSource, onOpenChat, onOpenDraft, onUpdate }: {
  la: LegalAnalysis;
  onSelectSource: (s: SourceRef) => void;
  onOpenChat: (key: string) => void;
  onOpenDraft: (type: DraftArtifactType, title?: string, extraInstruction?: string) => void;
  onUpdate: (updater: (la: LegalAnalysis) => LegalAnalysis) => void;
}) {
  const [expandedCharge, setExpandedCharge] = useState<number | null>(0);
  const [expandedStrategy, setExpandedStrategy] = useState<number | null>(0);
  const evidenceBalance: EvidenceBalance = la.evidence_balance ?? {
    prosecution_strength: 0.5,
    defense_strength: 0.5,
    key_prosecution_evidence: [],
    key_defense_evidence: [],
    critical_gaps: [],
    overall_assessment: '',
  };

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
    onUpdate(la => ({ ...la, strategies: [...la.strategies, { title: '', target_charge_id: null, strategy_type: '', priority: 'secondary', description: '', strengths: [], risks: [], required_evidence: [], source_refs: [] }] }));

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
    onUpdate(la => ({ ...la, evidence_balance: { ...(la.evidence_balance ?? evidenceBalance), ...patch } }));

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
            <div className="charge-card-header">
              <button className="charge-card-toggle" title="Espandi o riduci i dettagli del capo di imputazione" onClick={() => setExpandedCharge(expandedCharge === ci ? null : ci)}>
                {expandedCharge === ci ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              <div className="charge-card-content">
                <div className="charge-card-title-row">
                  <span className="charge-code">
                    <Editable value={charge.charge_code} onChange={v => updateCharge(ci, { charge_code: v })} placeholder="art." />
                  </span>
                  <span className="charge-name">
                    <Editable value={charge.charge_name} onChange={v => updateCharge(ci, { charge_name: v })} placeholder="Nome Reato" />
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
            <div className="strategy-header">
              <button className="strategy-toggle" title="Mostra o nascondi i dettagli della strategia difensiva" onClick={() => setExpandedStrategy(expandedStrategy === si ? null : si)}>
                {expandedStrategy === si ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </button>
              <div className="strategy-content">
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
                <Editable value={issue.legal_basis} onChange={v => updateIssue(ii, { legal_basis: v })} placeholder="Base legale…" />
              </em>
            </div>
            <div className="issue-remedy">
              <ShieldCheck size={13} />
              <span>
                <Editable value={issue.remedy} onChange={v => updateIssue(ii, { remedy: v })} placeholder="Rimedio…" />
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
              <div className="credibility-score" style={{ color: w.credibility_score >= 0.7 ? 'var(--critical)' : w.credibility_score >= 0.5 ? 'var(--warning)' : 'var(--success)' }}>
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
            <button title="Esegui azione"
              className="giulia-ctx-btn"
              onClick={() => onOpenDraft(
                'witnessCrossExam',
                `Controesame — ${w.witness_name || 'testimone'}`,
                `Preparami una sequenza di controesame per ${w.witness_name} (${w.role}, credibilità ${Math.round(w.credibility_score * 100)}%). Testimonianza chiave: "${w.key_testimony}". Vulnerabilità note: ${w.vulnerabilities.join('; ') || 'da sviluppare'}. Usa domande chiuse sì/no per massimizzare l'impatto.`
              )}
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
                <EditablePercent value={evidenceBalance.prosecution_strength} onChange={v => updateBalance({ prosecution_strength: v })} />
              </span>
              <StrengthBar value={evidenceBalance.prosecution_strength} label="Forza accusa" color="#ef4444" />
            </div>
            <div>
              <span className="muted" style={{ fontSize: '0.78rem' }}>Forza difesa:{' '}
                <EditablePercent value={evidenceBalance.defense_strength} onChange={v => updateBalance({ defense_strength: v })} />
              </span>
              <StrengthBar value={evidenceBalance.defense_strength} label="Forza difesa" color="#22c55e" />
            </div>
          </div>
          <div className="balance-cols">
            <div>
              <h4>Prove accusa</h4>
              <EditableStringList
                items={evidenceBalance.key_prosecution_evidence}
                onChange={items => updateBalance({ key_prosecution_evidence: items })}
                placeholder="Prova accusa…"
                itemClass="risk-item"
                addLabel="Aggiungi"
              />
            </div>
            <div>
              <h4>Prove difesa</h4>
              <EditableStringList
                items={evidenceBalance.key_defense_evidence}
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
              items={evidenceBalance.critical_gaps}
              onChange={items => updateBalance({ critical_gaps: items })}
              placeholder="Lacuna…"
              addLabel="Aggiungi lacuna"
            />
          </div>
          <p className="balance-assessment">
            <Editable
              value={evidenceBalance.overall_assessment}
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
            <button key={key} className="legal-drafting-card" title="Apri una nuova bozza nel workspace" onClick={() => onOpenDraft(key, label)}>
              <div className="legal-drafting-card-icon"><Icon size={18} /></div>
              <div className="legal-drafting-card-label">{label}</div>
              <div className="legal-drafting-card-desc">{desc}</div>
            </button>
          ))}
        </div>
        <p className="legal-drafting-note">
          L'AI prepara bozze locali modificabili: l'avvocato resta in controllo e verifica fonti, norme e precedenti prima del deposito.
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
          <button className="redact-toggle-chip" title="Attiva o disattiva questa regola di anonimizzazione" onClick={() => onChange(rules.map((x, j) => j === i ? { ...x, enabled: !x.enabled } : x))}>
            {r.enabled ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
          <button className="redact-delete-btn" title="Elimina definitivamente questa regola" onClick={() => onChange(rules.filter((_, j) => j !== i))}><X size={12} /></button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="source-drawer redact-drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-handle" />
        <div className="drawer-header">
          <div><p className="eyebrow">Privacy</p><h2>Anonimizza dati sensibili</h2></div>
          <button onClick={onClose} className="ghost-button" title="Chiudi la finestra corrente">Chiudi</button>
        </div>

        <div className="redact-add-form">
          <p className="eyebrow">Aggiungi regola</p>
          <div className="redact-add-row">
            <input className="upload-input" placeholder="Parola originale (es. Mario Rossi)" value={origInput} onChange={e => setOrigInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRule('global')} />
            <span style={{ color: 'var(--ink-3)', flexShrink: 0 }}>→</span>
            <input className="upload-input" placeholder="[OMISSIS]" value={replInput} onChange={e => setReplInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRule('global')} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="ghost-button" style={{ fontSize: '0.8rem', padding: '8px 12px' }} onClick={() => addRule('global')} title="Aggiungi regola a tutti i fascicoli" disabled={!origInput.trim()}>+ Globale</button>
            <button className="ghost-button" style={{ fontSize: '0.8rem', padding: '8px 12px' }} onClick={() => addRule('case')} title="Aggiungi regola solo a questo fascicolo" disabled={!origInput.trim()}>+ Solo questo caso</button>
          </div>
        </div>

        <RuleList rules={globalRules} onChange={setGlobalRules} title="Regole globali (tutti i fascicoli)" />
        <RuleList rules={caseRules} onChange={setCaseRules} title="Regole per questo fascicolo" />

        <div className="redact-section">
          <p className="eyebrow">Rilevamento AI</p>
          <button title="Azione secondaria" className="ghost-button" style={{ width: '100%', justifyContent: 'center', gap: 8 }} onClick={handleDetect} disabled={detecting}>
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
                  <button title="Azione secondaria" className="ghost-button" style={{ fontSize: '0.7rem', padding: '4px 8px', borderRadius: 6 }}
                    onClick={() => { setCaseRules([...caseRules, r]); setSuggested(suggested.filter(s => s.id !== r.id)); }}>
                    + Aggiungi
                  </button>
                </div>
              ))}
              <button title="Conferma operazione principale" className="primary-button" style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}
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
          <div><p className="eyebrow">Versione anonimizzata</p><h2>Testo anonimizzato</h2></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button title="Azione secondaria" className="ghost-button" onClick={() => navigator.clipboard.writeText(text).catch(() => {})}><Copy size={15} /></button>
            {typeof navigator.share === 'function' && (
              <button title="Azione secondaria" className="ghost-button" onClick={() => navigator.share({ title: 'Testo anonimizzato', text }).catch(() => {})}><Share2 size={15} /></button>
            )}
            <button className="ghost-button" onClick={onClose} title="Chiudi la finestra corrente">Chiudi</button>
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

function ExportCaseDrawer({
  onClose,
  onExport,
  hasAnonymizationRules,
}: {
  onClose: () => void;
  onExport: (opts: { includeDocs: boolean; protectedFile: boolean; password?: string; anonymized: boolean }) => Promise<void>;
  hasAnonymizationRules: boolean;
}) {
  const [mode, setMode] = useState<'protected' | 'plain'>('protected');
  const [includeDocs, setIncludeDocs] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [anonymized, setAnonymized] = useState(hasAnonymizationRules);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (mode === 'protected') {
      if (!password.trim()) { setError('Inserisci una password per proteggere il fascicolo.'); return; }
      if (password !== confirmPassword) { setError('Le password non coincidono.'); return; }
    } else if (!confirm('Confermi di voler esportare un file non protetto?\nIl contenuto sarà leggibile da chiunque abbia accesso al file.')) {
      return;
    }
    setBusy(true);
    try {
      await onExport({ includeDocs, protectedFile: mode === 'protected', password, anonymized: mode === 'plain' && anonymized });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="source-drawer export-drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-handle" />
        <div className="drawer-header">
          <div>
            <p className="eyebrow">Condivisione locale</p>
            <h2>Esporta fascicolo</h2>
          </div>
          <button className="ghost-button" onClick={onClose} title="Chiudi"><X size={16} /></button>
        </div>

        <p className="export-privacy-copy">
          I fascicoli restano su questo dispositivo. L’esportazione crea un file .plt che puoi trasferire manualmente su un altro dispositivo o inviare a un collega.
        </p>

        <div className="export-mode-grid">
          <button title="Seleziona questa modalità di esportazione" className={`export-mode-card${mode === 'protected' ? ' active' : ''}`} onClick={() => setMode('protected')}>
            <ShieldCheck size={18} />
            <strong>Proteggi con password — consigliato</strong>
            <span>Il contenuto viene cifrato nel browser prima del download. PLT non salva il file e non conosce la password.</span>
          </button>
          <button title="Seleziona questa modalità di esportazione" className={`export-mode-card export-mode-card-warning${mode === 'plain' ? ' active' : ''}`} onClick={() => setMode('plain')}>
            <ShieldAlert size={18} />
            <strong>Esporta senza password</strong>
            <span>Solo per debug, archiviazione locale sicura o dopo aver anonimizzato i dati sensibili.</span>
          </button>
        </div>

        {mode === 'protected' ? (
          <div className="export-fields">
            <label>Password <input type="password" value={password} onChange={e => setPassword(e.target.value)} /></label>
            <label>Conferma password <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></label>
            <p className="export-note">Chi riceve il file potrà aprirlo su un altro dispositivo, ma solo con questa password. Se la perdi, PLT non può recuperarla.</p>
            <p className="export-note">Consiglio: invia la password con un canale diverso dal file.</p>
          </div>
        ) : (
          <div className="export-warning-box">
            <strong>File non protetto</strong>
            <p>Il file .plt non protetto contiene i dati del fascicolo in chiaro. Prima di inviare un .plt non protetto, usa “Anonimizza” per sostituire nomi, indirizzi, numeri di procedimento e altri dati identificativi.</p>
            <label className="export-check-row">
              <input type="checkbox" checked={anonymized} disabled={!hasAnonymizationRules} onChange={e => setAnonymized(e.target.checked)} />
              Esporta copia anonimizzata {hasAnonymizationRules ? '' : '(aggiungi prima regole da “Anonimizza”)'}
            </label>
          </div>
        )}

        <label className="export-check-row">
          <input type="checkbox" checked={includeDocs} onChange={e => setIncludeDocs(e.target.checked)} />
          Includi documenti originali
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="drawer-actions">
          <button className="ghost-button" onClick={onClose} title="Annulla operazione">Annulla</button>
          <button title="Conferma operazione principale" className="primary-button" disabled={busy} onClick={submit}>
            {busy ? <Loader2 className="spin" size={15} /> : <Share2 size={15} />}
            {mode === 'protected' ? 'Esporta .plt protetto' : 'Esporta comunque'}
          </button>
        </div>
      </aside>
    </div>
  );
}

function DraftingWorkspace({
  caseTitle,
  drafts,
  activeDraftId,
  onSelectDraft,
  onUpdateDraft,
  onDeleteDraft,
  onExportDraft,
  onOpenProtectedPltExport,
}: {
  caseTitle: string;
  drafts: DraftArtifact[];
  activeDraftId: string | null;
  onSelectDraft: (id: string) => void;
  onUpdateDraft: (draft: DraftArtifact) => void;
  onDeleteDraft: (id: string) => void;
  onExportDraft: (draft: DraftArtifact, format: 'md' | 'txt' | 'html' | 'docx') => void;
  onOpenProtectedPltExport: () => void;
}) {
  const activeDraft = drafts.find(d => d.id === activeDraftId) ?? drafts[0] ?? null;

  if (!drafts.length) {
    return (
      <section className="panel draft-workspace-panel">
        <div className="draft-empty-state">
          <Sparkles size={24} />
          <h2>Workspace redazione atti</h2>
          <p className="muted">Clicca una card viola in “Analisi legale” per aprire una nuova bozza persistente. La chat resta solo per rifiniture e domande.</p>
        </div>
      </section>
    );
  }

  const verified = activeDraft.claim_refs.filter(c => c.status === 'sourced').length;
  const toCheck = activeDraft.claim_refs.filter(c => c.status !== 'sourced').length;

  return (
    <section className="panel draft-workspace-panel">
      <div className="draft-workspace-header">
        <div>
          <p className="eyebrow">Workspace redazione atti</p>
          <h2>{caseTitle}</h2>
          <p className="muted">Bozze locali del fascicolo. Ogni click su una card viola crea una nuova workspace tab.</p>
        </div>
        <button className="ghost-button" onClick={onOpenProtectedPltExport} title="Esporta l'intero fascicolo in .plt protetto">
          <ShieldCheck size={14} /> .plt protetto
        </button>
      </div>

      <div className="draft-tabs" role="tablist" aria-label="Bozze del fascicolo">
        {drafts.map((draft, idx) => (
          <button
            key={draft.id}
            role="tab"
            className={`draft-tab${draft.id === activeDraft.id ? ' active' : ''}`}
            onClick={() => onSelectDraft(draft.id)}
            title="Apri questa bozza"
          >
            <span>{idx + 1}. {draft.title}</span>
            <small>{draft.status} · {new Date(draft.created_at).toLocaleString('it')}</small>
          </button>
        ))}
      </div>

      <div className="draft-editor-grid">
        <div className="draft-editor-main">
          <label className="draft-title-field">
            Titolo bozza
            <input
              value={activeDraft.title}
              onChange={e => onUpdateDraft({ ...activeDraft, title: e.target.value })}
            />
          </label>
          <div className="draft-toolbar">
            <label>
              Stato
              <select
                value={activeDraft.status}
                onChange={e => onUpdateDraft({ ...activeDraft, status: e.target.value as DraftArtifact['status'] })}
              >
                <option value="draft">bozza</option>
                <option value="reviewing">in revisione</option>
                <option value="approved">approvata dall'avvocato</option>
                <option value="archived">archiviata</option>
              </select>
            </label>
            <button className="ghost-button" onClick={() => onDeleteDraft(activeDraft.id)} title="Archivia/elimina questa workspace"><Trash2 size={13} /> Elimina</button>
          </div>
          <textarea
            className="editable-input editable-input-multi draft-editor"
            value={activeDraft.content_markdown}
            onChange={e => onUpdateDraft({ ...activeDraft, content_markdown: e.target.value })}
            rows={24}
            placeholder="La bozza generata comparirà qui. Puoi modificarla liberamente: resta salvata nel fascicolo locale."
          />
        </div>

        <aside className="draft-side-panel">
          <div className="draft-guardrail-card">
            <ShieldAlert size={16} />
            <strong>Divieto precedenti inventati</strong>
            <p>Le citazioni Cassazione-like senza fonte sono marcate <strong>DA VERIFICARE</strong>. Prima del deposito verifica sempre banca dati, norme e fonti.</p>
          </div>

          <div className="draft-check-card">
            <h3>Verifiche</h3>
            <p><strong>{verified}</strong> claim con fonte · <strong>{toCheck}</strong> da verificare/unsupported</p>
            {activeDraft.claim_refs.length === 0 && <p className="muted">Nessuna citazione sospetta rilevata automaticamente.</p>}
            {activeDraft.claim_refs.map(claim => (
              <div key={claim.id} className={`draft-claim draft-claim-${claim.status}`}>
                <span>{claim.status === 'da_verificare' ? 'DA VERIFICARE' : claim.status}</span>
                <p>{claim.claim_text}</p>
              </div>
            ))}
          </div>

          <div className="draft-export-card">
            <h3>Esporta bozza</h3>
            <p className="export-note">{DRAFT_PLAINTEXT_EXPORT_WARNING}</p>
            <div className="draft-export-buttons">
              <button className="brief-action-btn" onClick={() => onExportDraft(activeDraft, 'md')}><FileText size={13} /> .md</button>
              <button className="brief-action-btn" onClick={() => onExportDraft(activeDraft, 'txt')}><FileText size={13} /> .txt</button>
              <button className="brief-action-btn" onClick={() => onExportDraft(activeDraft, 'html')}><FileText size={13} /> .html</button>
              <button className="brief-action-btn" onClick={() => onExportDraft(activeDraft, 'docx')}><FileText size={13} /> .docx</button>
            </div>
            <button className="primary-button draft-protected-export" onClick={onOpenProtectedPltExport} title="Proteggi tutto il fascicolo">
              <ShieldCheck size={14} /> Proteggi tutto come .plt
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}

// ── Case detail view ──────────────────────────────────────────────────────────

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'timeline', label: 'Cronologia' },
  { id: 'deadlines', label: 'Agenda' },
  { id: 'facts', label: 'Persone & prove' },
  { id: 'legal', label: 'Analisi legale' },
  { id: 'drafts', label: 'Bozze' },
  { id: 'questions', label: 'Da verificare' },
  { id: 'brief', label: 'Promemoria' },
];

function CaseDetailView({ caseId, session, onBack, onOpenChat, onCaseLoaded, onCaseAnalyzed }: { caseId: string; session: Session; onBack: () => void; onOpenChat: (key: string) => void; onCaseLoaded: (d: CaseAnalysis) => void; onCaseAnalyzed?: (d: CaseAnalysis) => void }) {
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
  const [redactionOverride, setRedactionOverride] = useState<boolean | null>(null);
  const [showRedactionDrawer, setShowRedactionDrawer] = useState(false);
  const [anonModal, setAnonModal] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [anonymizingDocId, setAnonymizingDocId] = useState<string | null>(null);
  const localOwnerId = useMemo(() => localOwnerIdFromSession(session), [session]);

  const { toast, showToast, dismissToast } = useToast();
  const { toggle: toggleTask, isDone, doneCount } = useCompletedTasks(caseId);
  const { globalRules, setGlobalRules } = useRedactionRules();
  const caseRedactionRules = caseData?.redaction_rules ?? [];
  const mergedRules = mergeRedactionRules(globalRules, caseRedactionRules);
  const hasActiveRules = mergedRules.some(r => r.enabled && r.original.trim());
  const redactionActive = redactionOverride !== null ? redactionOverride : hasActiveRules;

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
      const local = await dbGet(localOwnerId, caseId) as CaseAnalysis | null;
      if (local) { setCaseData(local); onCaseLoaded(local); return; }
      // Fall back to backend demo cases
      try {
        const r = await fetch(`${API}/api/cases/${caseId}`);
        if (!r.ok) throw new Error(`${r.status}`);
        const d = await r.json() as CaseAnalysis;
        setCaseData(d); onCaseLoaded(d);
      } catch (e) { setError((e as Error).message); }
    })();
  }, [caseId, localOwnerId, onCaseLoaded]);

  const scrollTo = (ref: React.RefObject<HTMLElement | HTMLHeadingElement | null>) => {
    setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  };

  // ── Upload queue callbacks ──────────────────────────────────────────────
  const processItems = useCallback(async (itemsToProcess: UploadQueueItem[]) => {
    if (itemsToProcess.length === 0) return;

    setUploadProcessing(true);
    setUploadQueue(prev => prev.map(i =>
      itemsToProcess.some(it => it.id === i.id) ? { ...i, status: 'uploading' as const } : i
    ));

    for (const item of itemsToProcess) {
      try {
        let text = item.text ?? '';
        if (!text) {
          if (!item.file) throw new Error('Nessun file o testo disponibile');
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
        }

        setUploadQueue(prev => prev.map(i =>
          i.id === item.id ? { ...i, status: 'done' as const, text } : i
        ));

        setCaseData(prevCase => {
          if (!prevCase) return prevCase;
          const newDoc: RawDocument = {
            doc_id: item.id,
            name: item.description || item.name,
            description: item.description || item.name,
            text,
            added_at: new Date().toISOString(),
            category: item.category,
          };
          const updated = {
            ...prevCase,
            raw_documents: [...(prevCase.raw_documents ?? []), newDoc],
          };
          dbSave(localOwnerId, updated);
          return updated;
        });

        const label = item.category === 'giurisprudenza' ? 'Precedente' : 'Documento';
        showToast(`${label} "${item.description || item.name}" aggiunto!`);
      } catch (e) {
        setUploadQueue(prev => prev.map(i =>
          i.id === item.id ? { ...i, status: 'error' as const, error: (e as Error).message } : i
        ));
        showToast(`Errore caricamento "${item.description || item.name}": ${(e as Error).message}`, 'error');
      }
    }
    setUploadProcessing(false);
  }, [showToast]);

  const handleAddFiles = useCallback((files: File[], category: 'fascicolo' | 'giurisprudenza' = 'fascicolo') => {
    const MAX_BYTES = 50 * 1024 * 1024;
    const oversized = files.filter(f => f.size > MAX_BYTES);
    if (oversized.length) showToast(`${oversized.map(f => f.name).join(', ')}: file troppo grande (max 50 MB)`, 'error');
    const accepted = files.filter(f => f.size <= MAX_BYTES);
    if (!accepted.length) return;
    const newItems: UploadQueueItem[] = accepted.map(f => ({
      id: crypto.randomUUID(),
      file: f,
      name: f.name,
      size: f.size,
      status: 'pending' as const,
      description: f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
      category,
    }));
    setUploadQueue(prev => [...prev, ...newItems]);
    processItems(newItems);
  }, [showToast, processItems]);

  const handleAddTextItem = useCallback((text: string, name?: string, category: 'fascicolo' | 'giurisprudenza' = 'fascicolo') => {
    const label = name || (category === 'giurisprudenza' ? 'Precedente incollato' : 'Testo incollato');
    const item: UploadQueueItem = {
      id: crypto.randomUUID(),
      file: null,
      name: label,
      size: text.length,
      status: 'done',
      text,
      description: label,
      category,
    };
    setUploadQueue(prev => [...prev, item]);

    setCaseData(prevCase => {
      if (!prevCase) return prevCase;
      const newDoc: RawDocument = {
        doc_id: item.id,
        name: label,
        description: label,
        text,
        added_at: new Date().toISOString(),
        category,
      };
      const updated = {
        ...prevCase,
        raw_documents: [...(prevCase.raw_documents ?? []), newDoc],
      };
      dbSave(localOwnerId, updated);
      return updated;
    });
    showToast(`"${label}" aggiunto!`);
  }, [showToast]);

  const handleAddUrlItem = useCallback(async (url: string, name: string) => {
    const id = crypto.randomUUID();
    const label = name.trim() || url;
    const item: UploadQueueItem = {
      id,
      file: null,
      name: label,
      size: 0,
      status: 'uploading',
      category: 'giurisprudenza',
      description: label,
    };
    setUploadQueue(prev => [...prev, item]);
    try {
      const res = await fetch(`${API}/api/fetch-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, name: label }),
      });
      if (!res.ok) throw new Error(`Fetch URL fallito (${res.status})`);
      const data = await res.json();
      const text: string = data.extracted_text ?? '';
      setUploadQueue(prev => prev.map(i => i.id === id ? { ...i, status: 'done', text, size: text.length } : i));
      setCaseData(prevCase => {
        if (!prevCase) return prevCase;
        const newDoc: RawDocument = {
          doc_id: id,
          name: label,
          description: label,
          text,
          added_at: new Date().toISOString(),
          category: 'giurisprudenza',
        };
        const updated = { ...prevCase, raw_documents: [...(prevCase.raw_documents ?? []), newDoc] };
        dbSave(localOwnerId, updated);
        return updated;
      });
      showToast(`Precedente "${label}" importato dall'URL!`);
    } catch (e) {
      setUploadQueue(prev => prev.map(i => i.id === id ? { ...i, status: 'error', error: (e as Error).message } : i));
      showToast(`Errore importazione URL: ${(e as Error).message}`, 'error');
    }
  }, [showToast]);

  const handleRemoveQueueItem = useCallback((id: string) => {
    setUploadQueue(prev => prev.filter(i => i.id !== id));
  }, []);

  const handleRetryQueueItem = useCallback((id: string) => {
    setUploadQueue(prev => {
      const item = prev.find(i => i.id === id);
      if (item) {
        const retryingItem = { ...item, status: 'pending' as const, error: undefined };
        processItems([retryingItem]);
        return prev.map(i => i.id === id ? retryingItem : i);
      }
      return prev;
    });
  }, [processItems]);

  const handleDeleteDoc = useCallback(async (docId: string) => {
    if (!caseData) return;
    const updated = { ...caseData, raw_documents: (caseData.raw_documents ?? []).filter(d => d.doc_id !== docId) };
    await dbSave(localOwnerId, updated);
    setCaseData(updated);
    showToast("Documento eliminato");
  }, [caseData, showToast]);

  const handleDeleteMaterial = useCallback(async (materialId: string) => {
    if (!caseData) return;
    const updated = { ...caseData, materials: caseData.materials.filter(m => m.id !== materialId) };
    await dbSave(localOwnerId, updated);
    setCaseData(updated);
    showToast("Materiale eliminato");
  }, [caseData, showToast]);

  const downloadPlt = useCallback((container: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(container, null, 2)], { type: 'application/vnd.pocket-legal-triage.case+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const buildExportCase = useCallback((includeDocs = false, anonymized = false) => {
    if (!caseData) return null;
    const rules = mergeRedactionRules(globalRules, caseData.redaction_rules ?? []);
    const base = anonymized ? applyRedactionToCase(caseData, rules) : caseData;
    return {
      ...base,
      raw_documents: includeDocs ? base.raw_documents : [],
      redaction_rules: [],
      analyzed_doc_ids: [],
    };
  }, [caseData, globalRules]);

  const handleExport = useCallback(async ({
    includeDocs = false,
    protectedFile = true,
    password = '',
    anonymized = false,
  }: { includeDocs?: boolean; protectedFile?: boolean; password?: string; anonymized?: boolean }) => {
    if (!caseData) return;
    try {
      const exportData = buildExportCase(includeDocs, anonymized);
      if (!exportData) return;
      const container = protectedFile
        ? await exportEncryptedPlt(exportData, password)
        : exportPlainPlt(exportData);
      downloadPlt(container, `${caseData.case_id}.plt`);
      showToast(protectedFile
        ? 'Fascicolo protetto esportato'
        : (anonymized ? 'Copia anonimizzata esportata senza password' : 'Fascicolo non protetto esportato'));
    } catch (e) {
      showToast(`Esportazione fallita: ${(e as Error).message}`, 'error');
    }
  }, [buildExportCase, caseData, downloadPlt, showToast]);

  const updateCase = useCallback(async (updater: (c: CaseAnalysis) => CaseAnalysis) => {
    if (!caseData) return;
    const updated = updater(caseData);
    await dbSave(localOwnerId, updated);
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

  const downloadTextFile = useCallback((content: string | Blob, filename: string, mime: string) => {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleOpenDraftWorkspace = useCallback(async (type: DraftArtifactType, title?: string, extraInstruction = '') => {
    if (!caseData) return;
    const sourceCase = redactionActive && hasActiveRules ? applyRedactionToCase(caseData, mergedRules) : caseData;
    const promptTail = type === 'witnessCrossExam'
      ? (ctx: string) => `${ctx}\n\n---\n${extraInstruction}`
      : DOC_PROMPTS[type] ?? DOC_PROMPTS.strategy;
    const prompt = buildDraftPrompt({
      caseData: sourceCase,
      type,
      promptTail,
      buildCaseContext,
      anonymized: redactionActive && hasActiveRules,
      extraInstruction: type === 'witnessCrossExam' ? '' : extraInstruction,
      workspaceTitle: title || draftTypeLabel(type),
    });
    const placeholder = createDraftArtifact({
      caseData,
      type,
      title: title || draftTypeLabel(type),
      prompt,
      anonymized: redactionActive && hasActiveRules,
      contentMarkdown: 'Generazione bozza in corso…\n\nLa workspace è già salvata nel fascicolo locale.',
    });
    const createdCase = addDraftArtifact(caseData, placeholder);
    await dbSave(localOwnerId, createdCase);
    setCaseData(createdCase);
    onCaseLoaded(createdCase);
    setActiveDraftId(placeholder.id);
    setActiveTab('drafts');
    showToast('Nuova workspace bozza creata');

    try {
      const generated = await fetchChatFull(prompt);
      const finalized = flagUnverifiedCassationCitations({
        ...placeholder,
        content_markdown: generated || 'Nessun contenuto generato. Riprova dalla chat o modifica manualmente questa bozza.',
        updated_at: new Date().toISOString(),
      });
      const finalizedCase = updateDraftArtifact(createdCase, finalized);
      await dbSave(localOwnerId, finalizedCase);
      setCaseData(finalizedCase);
      onCaseLoaded(finalizedCase);
      showToast('Bozza salvata nel fascicolo');
    } catch (e) {
      const failed = {
        ...placeholder,
        content_markdown: `Generazione non riuscita: ${(e as Error).message}\n\nPuoi comunque usare questa workspace: il prompt è salvato nei metadati della bozza.`,
        generation_notes: {
          ...placeholder.generation_notes,
          warnings: [...placeholder.generation_notes.warnings, `Generazione fallita: ${(e as Error).message}`],
        },
        updated_at: new Date().toISOString(),
      };
      const failedCase = updateDraftArtifact(createdCase, failed);
      await dbSave(localOwnerId, failedCase);
      setCaseData(failedCase);
      onCaseLoaded(failedCase);
      showToast(`Generazione bozza fallita: ${(e as Error).message}`, 'error');
    }
  }, [caseData, redactionActive, hasActiveRules, mergedRules, localOwnerId, onCaseLoaded, fetchChatFull, showToast, updateCase]);

  const handleUpdateDraft = useCallback((draft: DraftArtifact) => {
    updateCase(c => updateDraftArtifact(c, flagUnverifiedCassationCitations(draft)));
  }, [updateCase]);

  const handleDeleteDraft = useCallback((id: string) => {
    updateCase(c => ({ ...c, draft_artifacts: (c.draft_artifacts ?? []).filter(draft => draft.id !== id) }));
    setActiveDraftId(prev => prev === id ? null : prev);
    showToast('Workspace bozza eliminata');
  }, [updateCase, showToast]);

  const handleExportDraft = useCallback(async (draft: DraftArtifact, format: 'md' | 'txt' | 'html' | 'docx') => {
    if (format !== 'docx') {
      const exported = exportDraftArtifact(flagUnverifiedCassationCitations(draft), format);
      if (!confirm(`${exported.warning}\n\nProcedere con export ${format.toUpperCase()} non cifrato?`)) return;
      downloadTextFile(exported.content, exported.filename, exported.mime);
      showToast(`Bozza esportata in .${format}`);
      return;
    }
    if (!confirm(`${DRAFT_PLAINTEXT_EXPORT_WARNING}\n\nProcedere con export DOCX non cifrato?`)) return;
    try {
      const res = await fetch(`${API}/api/export-brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_title: draft.title, brief_markdown: draft.content_markdown }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const blob = await res.blob();
      downloadTextFile(blob, `${draft.title.replace(/[^\w\s-]/g, '').trim() || 'bozza'}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      showToast('Bozza esportata in DOCX');
    } catch (e) {
      showToast(`Export DOCX fallito: ${(e as Error).message}`, 'error');
    }
  }, [downloadTextFile, showToast]);

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
      await dbSave(localOwnerId, updated);
      setCaseData(updated);
      showToast('Documento anonimizzato');
    } catch (e) {
      showToast(`Errore: ${(e as Error).message}`, 'error');
    } finally {
      setAnonymizingDocId(null);
    }
  }, [caseData, fetchChatFull, showToast]);

  const handleAnalyze = useCallback(async (mode: 'flash' | 'pro' = 'flash') => {
    if (!caseData) return;
    if (mode === 'pro') {
      const ok = confirm('Avviare un Approfondimento Pro con GiulIA? Verrà eseguita un’analisi più profonda solo dopo questa conferma.');
      if (!ok) return;
    }
    const docs = caseData.raw_documents ?? [];
    if (docs.length === 0) {
      showToast('Aggiungi almeno un documento prima di analizzare', 'error');
      return;
    }

    const analyzedIds = new Set(caseData.analyzed_doc_ids ?? []);
    const newDocs = docs.filter(d => !analyzedIds.has(d.doc_id));
    const isIncremental = caseData.legal_analysis != null && newDocs.length > 0;

    setShowUpload(false);
    setUploadQueue(prev => prev.filter(i => i.status !== 'done')); // Clear completed items from drawer
    setAnalyzing(true);
    try {
      const sourceDocs = isIncremental ? newDocs : docs;
      const docMaterials = sourceDocs.map(d => ({ name: d.description || d.name, kind: 'text', text: d.text, category: d.category ?? 'fascicolo' }));
      const ctxMaterial = buildUserContextMaterial(caseData);
      const materials = ctxMaterial ? [ctxMaterial, ...docMaterials] : docMaterials;
      const res = await fetch(`${API}/api/analyze-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_title: caseData.case_title, materials, mode, language: 'it' }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const merged = mergeWithAi(caseData, await res.json() as CaseAnalysis);
      // Segna i doc come analizzati ma NON li elimina — restano visibili sotto "Documenti del fascicolo"
      const analyzedDocIds = docs.map(d => d.doc_id);
      const updated = { ...merged, raw_documents: docs, analyzed_doc_ids: analyzedDocIds };
      await dbSave(localOwnerId, updated);
      setCaseData(updated);
      onCaseLoaded(updated);
      onCaseAnalyzed?.(updated);
      if (updated.pro_recommendation?.recommended) {
        showToast('Analisi standard completata. GiulIA suggerisce un Approfondimento Pro: nessun addebito senza conferma.', 'info');
      }
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
      <button title="Azione secondaria" className="ghost-button" onClick={onBack}>← Torna ai fascicoli</button>
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
  const setRedactionActive = (val: boolean | ((prev: boolean) => boolean)) => {
    setRedactionOverride(prev => typeof val === 'function' ? val(prev !== null ? prev : hasActiveRules) : val);
  };
  const d = (redactionActive && hasActiveRules)
    ? applyRedactionToCase(caseData, mergedRules) : caseData;
  const la = d.legal_analysis;
  const nextDeadline = [...d.procedural_deadlines].sort((a, b) =>
    `${a.due_date}T${a.due_time ?? '23:59'}`.localeCompare(`${b.due_date}T${b.due_time ?? '23:59'}`)
  )[0];

  return (
    <main className="app-shell">
      {/* Back button */}
      <button className="back-button" title="Torna alla lista principale dei fascicoli" onClick={onBack}><ArrowLeft size={15} /> Fascicoli</button>

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
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 4 }}>
              <button
                className={`anonymize-action-btn${redactionActive ? ' anonymize-action-active' : ''}`}
                onClick={() => setShowRedactionDrawer(true)}
                title="Anonimizza dati sensibili prima di condividere"
              >
                {redactionActive ? <EyeOff size={13} /> : <ShieldCheck size={13} />}
                {redactionActive ? 'Vista anonimizzata' : `Anonimizza${mergedRules.filter(r => r.enabled).length ? ` · ${mergedRules.filter(r => r.enabled).length}` : ''}`}
              </button>
              {mergedRules.some(r => r.enabled) && (
                <button
                  className={`ghost-button redact-toggle-btn${redactionActive ? ' redact-toggle-active' : ''}`}
                  style={{ padding: '0 10px', height: 'auto', borderRadius: 999 }}
                  onClick={() => setRedactionActive(v => !v)}
                  title={redactionActive ? 'Mostra dati originali' : 'Mostra vista anonimizzata'}
                >
                  {redactionActive ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>
              )}
            </div>
            <button
              className="ghost-button"
              onClick={() => setShowExportModal(true)}
              title="Esporta fascicolo"
            >
              <Share2 size={13} /> Esporta
            </button>
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
          <button className="primary-button" onClick={() => setShowUpload(true)} title="Carica nuovi documenti PDF o immagini" style={uploadQueue.length > 0 ? { position: 'relative' } : undefined}>
            <Upload size={15} /> Aggiungi documento
            {uploadQueue.length > 0 && (
              <span className="upload-badge-hero">
                {uploadProcessing
                  ? <><Loader2 size={11} className="spin" /> {uploadQueue.filter(i => i.status === 'uploading' || i.status === 'pending').length} in elaborazione</>
                  : `${uploadQueue.length} in coda`}
              </span>
            )}
          </button>
          {(!hasExistingAnalysis || unanalyzedCount > 0) && (
            <button title="Esegui azione"
              className="secondary-button"
              onClick={() => handleAnalyze('flash')}
              disabled={analyzing || rawDocs.length === 0}
            >
              <Sparkles size={14} />
              {hasExistingAnalysis
                ? `Incorpora ${unanalyzedCount} documento${unanalyzedCount === 1 ? '' : 'i'}`
                : 'Analizza con AI'}
            </button>
          )}
          {hasExistingAnalysis && (
            <button
              className="ghost-button"
              onClick={() => {
                const updated = { ...caseData, analyzed_doc_ids: [], case_summary: '', materials: [], timeline: [], people: [], evidence: [], open_questions: [], missing_documents: [], contradictions: [], procedural_deadlines: [], brief_markdown: '', usage_estimate: { pages: 0, audio_minutes: 0, flash_input_tokens: 0, flash_output_tokens: 0, pro_used: false, model_route: '' }, pro_recommendation: { recommended: false, reasons: [], message: '', cta_label: 'Avvia Analisi Pro', alternate_label: 'Continua con analisi standard', requires_confirmation: true, auto_charge: false }, legal_analysis: null };
                dbSave(localOwnerId, updated).then(() => { setCaseData(updated); onCaseLoaded(updated); showToast('Analisi resettata. Ora puoi ri-analizzare da capo.'); });
              }}
              title="Resetta l'analisi e ri-analizza tutti i documenti da capo"
            >
              <RefreshCw size={13} /> Ri-analizza
            </button>
          )}
          <button className="aula-trigger-btn" title="Avvia la modalità Aula per la consultazione rapida in udienza" onClick={() => setAulaModeActive(true)}>
            <Gavel size={14} /> Aula
          </button>
        </div>
        {d.pro_recommendation?.recommended && (
          <div className="pro-recommendation-card" role="status" aria-live="polite">
            <div>
              <p className="eyebrow">Approfondimento Pro con GiulIA</p>
              <p>{d.pro_recommendation.message}</p>
              <p className="muted">L’analisi standard resta inclusa. Pro parte solo con conferma: nessun addebito automatico.</p>
            </div>
            <div className="pro-recommendation-actions">
              <button className="primary-button" onClick={() => handleAnalyze('pro')} disabled={analyzing || rawDocs.length === 0}>
                <Sparkles size={14} /> {d.pro_recommendation.cta_label}
              </button>
              <button
                className="ghost-button"
                onClick={() => updateCase(c => ({ ...c, pro_recommendation: { ...c.pro_recommendation!, recommended: false } }))}
              >
                {d.pro_recommendation.alternate_label}
              </button>
            </div>
          </div>
        )}
      </section>

      <GiuliaPromptBar onOpenChat={(msg) => onOpenChat(msg ?? '')} />

      {/* Stats */}
      <section className="stats-grid">
        <button className="stats-card" title="Vai a questa sezione" onClick={() => { scrollTo(materialsRef); }}>
          <FileText /><strong>{d.materials.length}</strong><span>materiali</span>
        </button>
        <button className="stats-card" title="Vai a questa sezione" onClick={() => { setActiveTab('timeline'); scrollTo(timelineRef); }}>
          <Clock /><strong>{d.timeline.length}</strong><span>eventi</span>
        </button>
        <button className="stats-card" title="Vai a questa sezione" onClick={() => { setActiveTab('questions'); scrollTo(contradictionsRef); }}>
          <AlertTriangle /><strong>{d.contradictions.length}</strong><span>contraddizioni</span>
        </button>
        <button className="stats-card" title="Vai a questa sezione" onClick={() => { setActiveTab('deadlines'); scrollTo(deadlinesRef); }}>
          <CalendarClock /><strong>{nextDeadline ? formatShortDate(nextDeadline.due_date) : '—'}</strong><span>priorità</span>
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
            <button title="Apri una nuova bozza di preparazione udienza"
              className="giulia-ctx-btn"
              onClick={e => {
                e.stopPropagation();
                handleOpenDraftWorkspace(
                  'strategy',
                  nextDeadline.title,
                  `Prepara una bozza operativa sulla prossima priorità "${nextDeadline.title}" (${nextDeadline.due_date}${nextDeadline.due_time ? ` alle ${nextDeadline.due_time}` : ''}). Indica priorità difensive, documenti da portare o acquisire, atti da predisporre, rischi, verifiche fattuali e fonti da controllare. Descrizione scadenza/priorità: ${nextDeadline.description}`
                );
              }}
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
          <button title="Esegui azione" key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>
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
            <div className="empty-state-placeholder">
              <p className="muted" style={{ marginBottom: 12 }}>Nessun evento ancora nella timeline.</p>
              <p className="muted" style={{ fontSize: '0.85rem' }}>Carica dei documenti e clicca su <strong>Analizza con AI</strong> in alto per estrarre automaticamente la cronologia dei fatti, oppure aggiungi un evento manualmente.</p>
            </div>
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
                <label className="muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(dl.feriale_applied)}
                    onChange={e => upd({ feriale_applied: e.target.checked })}
                  />
                  sospensione feriale applicata
                </label>
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
                      <button title="Esegui azione"
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
                status: 'candidate', urgency: 'media', description: '', feriale_applied: false,
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
              onOpenDraft={handleOpenDraftWorkspace}
              onUpdate={updater => updateCase(c => ({ ...c, legal_analysis: c.legal_analysis ? updater(c.legal_analysis) : null }))}
            />
          : (
            <section className="panel">
              <div className="empty-state-placeholder">
                <p className="muted" style={{ marginBottom: 12 }}>Nessuna analisi legale presente.</p>
                <p className="muted" style={{ fontSize: '0.85rem' }}>Carica dei documenti e clicca su <strong>Analizza con AI</strong> per estrarre in automatico capi di imputazione e strategia, oppure clicca qui sotto per creare l'analisi manualmente.</p>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                <button title="Conferma operazione principale" className="primary-button" onClick={() => handleAnalyze('flash')} disabled={analyzing || rawDocs.length === 0}>
                  <Sparkles size={14} /> Analizza con AI
                </button>
                <button title="Esegui azione"
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

      {/* Drafting workspace */}
      {activeTab === 'drafts' && (
        <DraftingWorkspace
          caseTitle={caseData.case_title}
          drafts={caseData.draft_artifacts ?? []}
          activeDraftId={activeDraftId}
          onSelectDraft={setActiveDraftId}
          onUpdateDraft={handleUpdateDraft}
          onDeleteDraft={handleDeleteDraft}
          onExportDraft={handleExportDraft}
          onOpenProtectedPltExport={() => setShowExportModal(true)}
        />
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
                <button className="giulia-ctx-btn" title="Chiedi a GiulIA di analizzare questo elemento in dettaglio" onClick={() => onOpenChat(`Come indago questa questione: "${q.question}"? Perché conta: ${q.why_it_matters}. Suggerisci le mosse concrete per rispondere a questa domanda difensiva.`)}>
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
                <button className="giulia-ctx-btn" title="Chiedi a GiulIA di analizzare questo elemento in dettaglio" onClick={() => onOpenChat(`Come possiamo sfruttare in udienza la contraddizione "${ct.title}"? ${ct.description} Suggerisci come usarla nella strategia difensiva e quali domande fare ai testimoni.`)}>
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
            <button className="brief-action-btn" title="Azione rapida sul documento" onClick={exportBriefDocx}><FileText size={14} /> Scarica DOCX</button>
            <button className="brief-action-btn" title="Azione rapida sul documento" onClick={exportBrief}><Copy size={14} /> Copia</button>
            <button className="brief-action-btn" title="Azione rapida sul documento" onClick={shareBrief}><Share2 size={14} /> Condividi</button>
            <button className="brief-action-btn" title="Azione rapida sul documento" onClick={handleAnonymizeBrief}><EyeOff size={14} /> Anonimizza</button>
            <button className="brief-action-btn" title="Azione rapida sul documento" onClick={() => setAulaModeActive(true)}><Gavel size={14} /> Aula Mode</button>
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
            <p className="eyebrow">Stima token richiesti</p>
            <p>
              {caseData.usage_estimate.pages} pag · {caseData.usage_estimate.audio_minutes} min audio ·
              Flash {caseData.usage_estimate.flash_input_tokens}/{caseData.usage_estimate.flash_output_tokens} tok ·
              Pro: {caseData.usage_estimate.pro_used ? 'sì' : 'no'}
            </p>
          </div>
        </section>
      )}

      {/* Raw documents (always visible — the source files in this fascicolo) */}
      <section ref={materialsRef} className="materials-panel">
        <div className="materials-header">
          <h2>Documenti del fascicolo ({rawDocs.length})</h2>
          <button className="upload-fab" title="Aggiungi nuovi documenti al fascicolo" onClick={() => setShowUpload(true)}>
            <Plus size={16} /> Aggiungi
            {uploadQueue.length > 0 && <span className="upload-badge">{uploadQueue.length}</span>}
          </button>
        </div>
        {rawDocs.length === 0 && (
          <p className="muted">Nessun documento. Aggiungi PDF, testi o note manuali.</p>
        )}
        {rawDocs.map(doc => (
          <div key={doc.doc_id} className="pending-doc-row">
            <button className="pending-doc-item pending-doc-item-flex" title="Visualizza il contenuto estratto dal documento" onClick={() => setSelectedRawDoc(doc)}>
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
              <button className="material-button pending-doc-item-flex" title="Visualizza questo materiale investigativo" onClick={() => setSelectedMaterial(m)}>
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
          onClose={() => {
            setShowRedactionDrawer(false);
            setRedactionOverride(null);
          }}
          caseCtx={buildCaseContext(caseData)}
          apiBase={API}
        />
      )}
      {anonModal !== null && <AnonModal text={anonModal} onClose={() => setAnonModal(null)} />}
      {showExportModal && (
        <ExportCaseDrawer
          onClose={() => setShowExportModal(false)}
          onExport={handleExport}
          hasAnonymizationRules={mergedRules.some(r => r.enabled && r.original.trim())}
        />
      )}
      {showUpload && (
        <Suspense fallback={null}>
          <MultiFileUploadDrawer
            queue={uploadQueue}
            onClose={() => {
              setUploadQueue(prev => prev.filter(i => i.status !== 'done'));
              setShowUpload(false);
            }}
            onAddFiles={handleAddFiles}
            onRemoveItem={handleRemoveQueueItem}
            onRetryItem={handleRetryQueueItem}
            onAddTextItem={handleAddTextItem}
            processing={uploadProcessing}
            onAnalyze={() => handleAnalyze('flash')}
          />
        </Suspense>
      )}
      {aulaModeActive && <AulaModeOverlay caseData={caseData} onClose={() => setAulaModeActive(false)} />}
      {toast && <ToastNotification message={toast.message} type={toast.type} onDismiss={dismissToast} />}
    </main>
  );
}

export default CaseDetailView;
