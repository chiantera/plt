import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertTriangle, ArrowLeft, ArrowRight, BookOpen, BriefcaseBusiness,
  CalendarClock, CheckCircle2, CheckSquare, ChevronDown, ChevronRight,
  Clock, Copy, FileText, Gavel, Loader2, MapPin, MessageSquare, Mic, Plus,
  Scale, Search, Send, Share2, ShieldAlert, ShieldCheck, ShieldOff, Sparkles,
  Square, Upload, Users, X, Zap,
} from 'lucide-react';
import './styles.css';
import { installMockApi } from './data/mockApi';

installMockApi();

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

type CaseAnalysis = {
  case_id: string; case_title: string; language: string; case_summary: string;
  materials: Material[]; timeline: TimelineEvent[]; people: Person[];
  evidence: EvidenceItem[]; open_questions: OpenQuestion[]; missing_documents: MissingDocument[];
  contradictions: Contradiction[]; procedural_deadlines: ProceduralDeadline[];
  brief_markdown: string; usage_estimate: UsageEstimate; legal_analysis: LegalAnalysis | null;
};

type CaseSummary = {
  case_id: string; case_title: string; client_name: string; case_summary: string;
  charge_summary: string; next_deadline_date: string | null; next_deadline_title: string | null;
  contradiction_count: number; material_count: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical' | null; status: string; created_at: string;
};

type TabId = 'timeline' | 'deadlines' | 'facts' | 'legal' | 'questions' | 'brief';

type ChatMsg = { role: 'user' | 'assistant'; content: string; id: string; };
type ChatState = { open: boolean; messages: ChatMsg[]; caseContext: string | null; };

function buildCaseContext(c: CaseAnalysis): string {
  const la = c.legal_analysis;
  let ctx = `FASCICOLO: ${c.case_title}\n\nSINTESI: ${c.case_summary}\n\n`;
  if (la) {
    ctx += `ACCUSE:\n${la.charges.map(ch => `• ${ch.charge_code} — ${ch.charge_name} (max: ${ch.max_sentence})`).join('\n')}\n\n`;
    ctx += `RISCHIO: ${la.risk_level.toUpperCase()} — ${la.risk_summary}\n\n`;
    ctx += `STRATEGIA PRINCIPALE:\n${la.strategies[0]?.title}: ${la.strategies[0]?.description}\n\n`;
    if (la.constitutional_issues.length > 0) {
      ctx += `QUESTIONI PROCEDURALI:\n${la.constitutional_issues.map(i => `• ${i.title}\n  Base legale: ${i.legal_basis}\n  Rimedio: ${i.remedy}`).join('\n')}\n\n`;
    }
    ctx += `CONTRADDIZIONI:\n${c.contradictions.map(ct => `• ${ct.title}: ${ct.description}`).join('\n')}\n\n`;
    ctx += `TESTIMONI:\n${la.witness_assessments.map(w => `• ${w.witness_name} (${w.role}, credibilità ${Math.round(w.credibility_score * 100)}%): ${w.key_testimony}`).join('\n')}\n\n`;
    ctx += `BILANCIAMENTO PROVE:\n  Accusa: ${Math.round(la.evidence_balance.prosecution_strength * 100)}% — ${la.evidence_balance.key_prosecution_evidence.join('; ')}\n  Difesa: ${Math.round(la.evidence_balance.defense_strength * 100)}% — ${la.evidence_balance.key_defense_evidence.join('; ')}\n  Lacune: ${la.evidence_balance.critical_gaps.join('; ')}`;
  }
  return ctx;
}

const DOC_PROMPTS: Record<string, (ctx: string) => string> = {
  memoria: ctx => `${ctx}\n\n---\nRedigi una memoria difensiva completa per questo caso. Struttura l'atto secondo il formato italiano standard:\n\n**INTESTAZIONE** (Tribunale competente, numero procedimento, imputato, difensore)\n**IN FATTO** — narrazione precisa dei fatti rilevanti per la difesa\n**IN DIRITTO** — motivi giuridici articolati, con:\n  - Citazioni normative specifiche (art. X c.p. / art. X c.p.p.)\n  - Precedenti della Cassazione Penale (sezione, numero, anno)\n  - Interpretazioni dottrinali rilevanti\n**CONCLUSIONI** — richieste formali al giudice\n\nScrivi in italiano giuridico formale. Sii specifico e approfondito, non generico.`,

  cassazione: ctx => `${ctx}\n\n---\nPredisponi un ricorso per Cassazione avverso eventuale sentenza di condanna. Sviluppa i motivi di ricorso ex art. 606 c.p.p. più solidi per questo caso. Per ogni motivo:\n\n**MOTIVO N. X — [tipo ex lett. a/b/c/d/e art. 606 c.p.p.]**\n  - Formulazione tecnica del motivo\n  - Norma o principio violato\n  - Argomentazione sviluppata\n  - Precedenti della Cassazione favorevoli (cita sezione e numero)\n\nConcentrati sui vizi di legittimità più fondati: violazione di legge (lett. b), vizio di motivazione (lett. e), inutilizzabilità prove (lett. c).`,

  eccezione: ctx => `${ctx}\n\n---\nRedigi un'eccezione procedurale formale da depositare in udienza, focalizzata sul vizio processuale più solido del fascicolo. Struttura:\n\n**TITOLO ECCEZIONE**\n**NORMA VIOLATA** (articolo preciso del c.p.p. o legge speciale)\n**IN FATTO** — descrizione della violazione procedurale concreta\n**IN DIRITTO** — argomentazione giuridica con:\n  - Interpretazione della norma violata\n  - Conseguenza processuale (nullità / inutilizzabilità / inammissibilità)\n  - Giurisprudenza della Cassazione che supporta l'eccezione\n**RICHIESTA** — provvedimento chiesto al giudice\n\nSii preciso: indica se si tratta di nullità assoluta, relativa, o inutilizzabilità patologica/fisiologica.`,

  crossExam: ctx => `${ctx}\n\n---\nPreparazione per il controesame dei testimoni dell'accusa. Per ciascun testimone nel fascicolo, sviluppa:\n\n**[NOME TESTIMONE — ruolo]**\nCredibilità: [score]\n\n*Obiettivo del controesame*: [minare la credibilità / estrarre ammissioni favorevoli / limitare il danno]\n\n*Sequenza di domande*:\n1. [domanda di apertura — fatto non contestabile]\n2-5. [sviluppo logico verso la contraddizione o l'ammissione]\nX. [domanda finale incisiva]\n\n*Trappole da evitare*:\n*Documenti da usare come confronto*:\n\nUsa la tecnica del controesame a domande chiuse (sì/no).`,

  strategy: ctx => `${ctx}\n\n---\nAnalisi strategica approfondita del caso. Valuta ogni linea difensiva con occhio critico da avvocato esperto:\n\nPer ogni strategia:\n- **Probabilità di successo** (realistica, non ottimistica)\n- **Prove necessarie ancora da acquisire**\n- **Rischi e controindicazioni**\n- **Giurisprudenza favorevole** (Cass. pen., sezione, numero)\n- **Tempistica tattica** — quando e come giocare questa carta\n\nConcludi con una **raccomandazione tattica generale**: quale combinazione di strategie adottare, in quale ordine, e quale eventuale piano B prepararsi.`,
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

function UploadDrawer({ onClose, onAnalyze }: { onClose: () => void; onAnalyze: (title: string, text: string, name: string) => void }) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [docName, setDocName] = useState('documento.txt');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setDocName(file.name);
    if (file.type.startsWith('text/') || file.name.endsWith('.txt')) {
      setText(await file.text());
    } else {
      try {
        const fd = new FormData();
        fd.append('file', file);
        setUploading(true);
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const data = await res.json();
        setText(data.extracted_text ?? '');
      } finally {
        setUploading(false);
      }
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const canSubmit = title.trim() && text.trim();

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="source-drawer upload-drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-handle" />
        <div className="drawer-header">
          <div><p className="eyebrow">Nuovo materiale</p><h2>Carica documento</h2></div>
          <button onClick={onClose} className="ghost-button"><X size={18} /></button>
        </div>

        <div className="upload-field">
          <label>Titolo del caso</label>
          <input
            className="upload-input"
            placeholder="es. Caso Rossi — Furto aggravato"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>

        <div
          className={`drop-zone${dragging ? ' dragging' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          {uploading
            ? <><Loader2 className="spin" size={28} /><p>Estrazione testo…</p></>
            : <><Upload size={28} /><p>Trascina un file o clicca per selezionarlo</p><small>TXT, PDF, immagini, audio</small></>
          }
          <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={onFileChange}
            accept=".txt,.pdf,.jpg,.jpeg,.png,.mp3,.mp4,.m4a,.wav,.ogg" />
        </div>

        <div className="upload-field">
          <label>Oppure incolla il testo</label>
          <textarea
            className="upload-textarea"
            placeholder="Incolla qui il testo del documento…"
            value={text}
            onChange={e => setText(e.target.value)}
            rows={7}
          />
        </div>

        <div className="upload-actions">
          <button className="ghost-button" onClick={onClose}>Annulla</button>
          <button
            className="primary-button"
            disabled={!canSubmit}
            onClick={() => canSubmit && onAnalyze(title, text, docName)}
          >
            <Zap size={15} /> Analizza con AI
          </button>
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
  state, onClose, onSend, onQuickAction, streaming,
}: {
  state: ChatState;
  onClose: () => void;
  onSend: (msg: string) => void;
  onQuickAction: (key: string) => void;
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
    { key: 'memoria',    label: 'Memoria difensiva',    icon: FileText },
    { key: 'cassazione', label: 'Ricorso Cassazione',   icon: Scale },
    { key: 'eccezione',  label: 'Eccezione procedurale', icon: ShieldAlert },
    { key: 'crossExam',  label: 'Controesame testimoni', icon: Users },
    { key: 'strategy',   label: 'Analisi strategica',    icon: Sparkles },
  ] as const;

  const isEmpty = state.messages.length === 0;

  return (
    <div className={`chat-overlay ${state.open ? 'chat-overlay--open' : ''}`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="chat-drawer">
        <div className="chat-header">
          <div className="chat-header-title">
            <div className="chat-header-icon"><Sparkles size={16} /></div>
            <div>
              <div className="chat-header-name">Assistente Legale AI</div>
              {state.caseContext && <div className="chat-header-sub">Contesto fascicolo attivo</div>}
            </div>
          </div>
          <button className="chat-close-btn" onClick={onClose}><X size={20} /></button>
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
              <h3>Assistente legale</h3>
              {state.caseContext
                ? <p>Conosco il fascicolo. Posso redigere memorie difensive, ricorsi per Cassazione, eccezioni procedurali, o rispondere a qualsiasi domanda di diritto penale italiano.</p>
                : <p>Sono specializzato in diritto penale italiano. Conosco il Codice Penale, il Codice di Procedura Penale e la giurisprudenza della Cassazione. Apri un fascicolo per abilitare la redazione di atti processuali.</p>
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
    <button className={`chat-fab ${hasContext ? 'chat-fab--context' : ''}`} onClick={onClick} aria-label="Apri assistente legale">
      <MessageSquare size={22} />
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

function CaseListView({ onSelect }: { onSelect: (id: string) => void }) {
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [search, setSearch] = useState('');

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
    fetch('/api/cases')
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json() as Promise<CaseSummary[]>; })
      .then(setCases)
      .catch(e => setError(e.message));
  }, []);

  const handleAnalyze = useCallback(async (title: string, text: string, name: string) => {
    setShowUpload(false);
    setAnalyzing(true);
    try {
      const res = await fetch('/api/analyze-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_title: title, materials: [{ name, kind: 'text', text }], mode: 'flash', language: 'it' }),
      });
      if (!res.ok) throw new Error(`Analisi fallita: ${res.status}`);
      const newCase = await res.json() as CaseAnalysis;
      (window as any).__newCase = newCase;
      onSelect('__new__');
    } catch (e) {
      alert(`Errore: ${(e as Error).message}`);
    } finally {
      setAnalyzing(false);
    }
  }, [onSelect]);

  return (
    <main className="app-shell home-shell">

      {/* ── Hero ── */}
      <header className="home-hero">
        <div className="home-brand">
          <div className="home-brand-icon"><Gavel size={22} /></div>
          <div>
            <div className="home-brand-name">Pocket Legal Triage</div>
            <div className="home-brand-tagline">Studio Legale · Milano</div>
          </div>
        </div>
        <h1 className="home-headline">
          I tuoi<br /><span className="home-headline-accent">fascicoli</span>
        </h1>
        {cases && <HomepageStats cases={cases} />}
      </header>

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
      </div>

      {analyzing && (
        <div className="analyzing-banner">
          <Loader2 className="spin" size={18} />
          Analisi AI in corso — attendere…
        </div>
      )}

      {error && <div className="error-banner"><AlertTriangle size={16} /> {error}</div>}

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
          <button key={c.case_id} className="case-card" onClick={() => onSelect(c.case_id)}>
            <div className="case-card-header">
              <div className="case-card-risk" style={{ background: riskColor(c.risk_level) + '22', border: `1px solid ${riskColor(c.risk_level)}55` }}>
                <span style={{ color: riskColor(c.risk_level) }}>{riskIcon(c.risk_level)} {riskLabel(c.risk_level)}</span>
              </div>
              <ChevronRight size={18} className="case-card-arrow" />
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

      {showUpload && <UploadDrawer onClose={() => setShowUpload(false)} onAnalyze={handleAnalyze} />}
    </main>
  );
}

// ── Legal analysis tab ────────────────────────────────────────────────────────


function LegalAnalysisTab({ la, onSelectSource, onOpenChat }: { la: LegalAnalysis; onSelectSource: (s: SourceRef) => void; onOpenChat: (key: string) => void }) {
  const [expandedCharge, setExpandedCharge] = useState<number | null>(0);
  const [expandedStrategy, setExpandedStrategy] = useState<number | null>(0);

  return (
    <section className="panel legal-panel">

      {/* Risk banner */}
      <div className="risk-banner" style={{ borderColor: riskColor(la.risk_level) + '66', background: riskColor(la.risk_level) + '11' }}>
        <div className="risk-banner-label" style={{ color: riskColor(la.risk_level) }}>
          {riskIcon(la.risk_level)} Rischio {riskLabel(la.risk_level)}
        </div>
        <p>{la.risk_summary}</p>
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

      {/* Immediate actions */}
      <div className="legal-section">
        <h2><Zap size={16} /> Azioni immediate</h2>
        <ul className="action-list">
          {la.immediate_actions.map((a, i) => (
            <li key={i} className="action-item"><CheckCircle2 size={14} /><span>{a}</span></li>
          ))}
        </ul>
      </div>

      {/* Charges */}
      <div className="legal-section">
        <h2><Scale size={16} /> Analisi delle accuse</h2>
        {la.charges.map((charge, ci) => (
          <div key={charge.charge_code} className="charge-card">
            <button className="charge-card-header" onClick={() => setExpandedCharge(expandedCharge === ci ? null : ci)}>
              <div className="charge-card-title-row">
                <span className="charge-code">{charge.charge_code}</span>
                <span className="charge-name">{charge.charge_name}</span>
              </div>
              <div className="charge-card-meta-row">
                <div className="strength-mini">
                  <div className="strength-mini-fill" style={{ width: `${charge.prosecution_strength * 100}%`, background: `hsl(${(1 - charge.prosecution_strength) * 120}, 70%, 50%)` }} />
                </div>
                <span className="charge-strength-label">Accusa {pct(charge.prosecution_strength)}</span>
                {expandedCharge === ci ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>
            </button>
            {expandedCharge === ci && (
              <div className="charge-card-body">
                <p className="charge-sentence"><strong>Pena massima:</strong> {charge.max_sentence}</p>
                <h4>Elementi costitutivi</h4>
                <div className="elements-table">
                  {charge.elements_required.map((el, ei) => (
                    <div key={ei} className="element-row">
                      <div className="element-status-dot" style={{ background: elementStatusColor(el.status) }} title={elementStatusLabel(el.status)} />
                      <div className="element-body">
                        <strong>{el.element}</strong>
                        <p>{el.description}</p>
                        <p className="element-notes">{el.notes}</p>
                        <span className={`element-chip element-${el.status}`}>{elementStatusLabel(el.status)}</span>
                        <SourceRow refs={el.source_refs} onSelect={onSelectSource} />
                      </div>
                    </div>
                  ))}
                </div>
                <h4>Difese disponibili</h4>
                <ul className="defense-list">
                  {charge.available_defenses.map((d, di) => <li key={di}>{d}</li>)}
                </ul>
                {charge.notes && <p className="charge-notes">{charge.notes}</p>}
                <SourceRow refs={charge.source_refs} onSelect={onSelectSource} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Defense strategies */}
      <div className="legal-section">
        <h2><ShieldCheck size={16} /> Strategie difensive</h2>
        {la.strategies.map((s, si) => (
          <div key={si} className={`strategy-card strategy-${s.priority}`}>
            <button className="strategy-header" onClick={() => setExpandedStrategy(expandedStrategy === si ? null : si)}>
              <div className="strategy-title-row">
                <span className={`priority-badge priority-${s.priority}`}>{s.priority === 'primary' ? 'Primaria' : s.priority === 'secondary' ? 'Secondaria' : 'Fallback'}</span>
                <span className="strategy-type-badge">{strategyTypeLabel(s.strategy_type)}</span>
              </div>
              <div className="strategy-title">{s.title}</div>
              <div className="strategy-expand">{expandedStrategy === si ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</div>
            </button>
            {expandedStrategy === si && (
              <div className="strategy-body">
                <p>{s.description}</p>
                <div className="strategy-cols">
                  <div className="strategy-col">
                    <h4>Punti di forza</h4>
                    <ul>{s.strengths.map((p, i) => <li key={i} className="pro-item">{p}</li>)}</ul>
                  </div>
                  <div className="strategy-col">
                    <h4>Rischi</h4>
                    <ul>{s.risks.map((r, i) => <li key={i} className="risk-item">{r}</li>)}</ul>
                  </div>
                </div>
                {s.required_evidence.length > 0 && (
                  <>
                    <h4>Prove necessarie</h4>
                    <ul className="evidence-needed">{s.required_evidence.map((e, i) => <li key={i}><Search size={12} />{e}</li>)}</ul>
                  </>
                )}
                <SourceRow refs={s.source_refs} onSelect={onSelectSource} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Constitutional issues */}
      {la.constitutional_issues.length > 0 && (
        <div className="legal-section">
          <h2><ShieldAlert size={16} /> Problemi costituzionali / procedurali</h2>
          {la.constitutional_issues.map((issue, ii) => (
            <div key={ii} className={`issue-card issue-${issue.severity}`}>
              <div className="issue-header">
                <span className={`severity-badge severity-${issue.severity}`}>{issue.severity === 'critical' ? 'Critico' : issue.severity === 'significant' ? 'Significativo' : 'Minore'}</span>
                <span className="issue-type">{issueTypeLabel(issue.issue_type)}</span>
              </div>
              <h3>{issue.title}</h3>
              <p>{issue.description}</p>
              <div className="issue-law"><BookOpen size={13} /> <em>{issue.legal_basis}</em></div>
              <div className="issue-remedy"><ShieldCheck size={13} /><span>{issue.remedy}</span></div>
              <SourceRow refs={issue.source_refs} onSelect={onSelectSource} />
            </div>
          ))}
        </div>
      )}

      {/* Witness assessments */}
      {la.witness_assessments.length > 0 && (
        <div className="legal-section">
          <h2><Users size={16} /> Valutazione testimoni</h2>
          {la.witness_assessments.map((w, wi) => (
            <div key={wi} className={`witness-card witness-${w.role}`}>
              <div className="witness-header">
                <div>
                  <strong>{w.witness_name}</strong>
                  <span className={`witness-role-badge role-${w.role}`}>{witnessRoleLabel(w.role)}</span>
                </div>
                <div className="credibility-score" style={{ color: w.credibility_score >= 0.7 ? '#ef4444' : w.credibility_score >= 0.5 ? '#f97316' : '#22c55e' }}>
                  {pct(w.credibility_score)} cred.
                </div>
              </div>
              <StrengthBar value={w.credibility_score} label="Credibilità percepita" color={`hsl(${(1 - w.credibility_score) * 30}, 80%, 55%)`} />
              <p className="witness-testimony">&ldquo;{w.key_testimony}&rdquo;</p>
              <div className="witness-cols">
                {w.strengths.length > 0 && (
                  <div>
                    <h4>Punti forti</h4>
                    <ul>{w.strengths.map((s, i) => <li key={i} className="pro-item">{s}</li>)}</ul>
                  </div>
                )}
                {w.vulnerabilities.length > 0 && (
                  <div>
                    <h4>Vulnerabilità</h4>
                    <ul>{w.vulnerabilities.map((v, i) => <li key={i} className="risk-item">{v}</li>)}</ul>
                  </div>
                )}
              </div>
              {w.cross_examination_angles.length > 0 && (
                <>
                  <h4>Domande cross-examination</h4>
                  <ul className="cross-list">{w.cross_examination_angles.map((q, i) => <li key={i}><ArrowRight size={12} />{q}</li>)}</ul>
                </>
              )}
              <SourceRow refs={w.source_refs} onSelect={onSelectSource} />
            </div>
          ))}
        </div>
      )}

      {/* Evidence balance */}
      <div className="legal-section">
        <h2><Scale size={16} /> Equilibrio probatorio</h2>
        <div className="balance-card">
          <div className="balance-bars">
            <StrengthBar value={la.evidence_balance.prosecution_strength} label="Forza accusa" color="#ef4444" />
            <StrengthBar value={la.evidence_balance.defense_strength} label="Forza difesa" color="#22c55e" />
          </div>
          <div className="balance-cols">
            <div>
              <h4>Prove accusa</h4>
              <ul>{la.evidence_balance.key_prosecution_evidence.map((e, i) => <li key={i} className="risk-item">{e}</li>)}</ul>
            </div>
            <div>
              <h4>Prove difesa</h4>
              <ul>{la.evidence_balance.key_defense_evidence.map((e, i) => <li key={i} className="pro-item">{e}</li>)}</ul>
            </div>
          </div>
          {la.evidence_balance.critical_gaps.length > 0 && (
            <div className="balance-gaps">
              <h4><Search size={13} /> Lacune critiche</h4>
              <ul>{la.evidence_balance.critical_gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
            </div>
          )}
          <p className="balance-assessment">{la.evidence_balance.overall_assessment}</p>
        </div>
      </div>

      {/* Client summary */}
      <div className="client-summary-box">
        <h2><Users size={16} /> Sintesi per il cliente</h2>
        <p>{la.client_summary}</p>
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

// ── Case detail view ──────────────────────────────────────────────────────────

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'timeline', label: 'Cronologia' },
  { id: 'deadlines', label: 'Agenda' },
  { id: 'facts', label: 'Persone & prove' },
  { id: 'legal', label: 'Analisi legale' },
  { id: 'questions', label: 'Da verificare' },
  { id: 'brief', label: 'Promemoria' },
];

function CaseDetailView({ caseId, onBack, onOpenChat, onCaseLoaded }: { caseId: string; onBack: () => void; onOpenChat: (key: string) => void; onCaseLoaded: (d: CaseAnalysis) => void }) {
  const [caseData, setCaseData] = useState<CaseAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('timeline');
  const [selectedSource, setSelectedSource] = useState<SourceRef | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aulaModeActive, setAulaModeActive] = useState(false);

  const { toast, showToast, dismissToast } = useToast();
  const { toggle: toggleTask, isDone, doneCount } = useCompletedTasks(caseId);

  const exportBrief = useCallback(async () => {
    if (!caseData) return;
    try {
      await navigator.clipboard.writeText(caseData.brief_markdown);
      showToast('Promemoria copiato negli appunti!');
    } catch {
      showToast('Copia non riuscita', 'error');
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
    fetch(`/api/cases/${caseId}`)
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json() as Promise<CaseAnalysis>; })
      .then(d => { setCaseData(d); onCaseLoaded(d); })
      .catch(e => setError(e.message));
  }, [caseId]);

  const nextDeadline = useMemo(() => {
    return [...(caseData?.procedural_deadlines ?? [])].sort((a, b) => {
      const as_ = `${a.due_date}T${a.due_time ?? '23:59'}`;
      const bs = `${b.due_date}T${b.due_time ?? '23:59'}`;
      return as_.localeCompare(bs);
    })[0];
  }, [caseData]);

  const scrollTo = (ref: React.RefObject<HTMLElement | HTMLHeadingElement | null>) => {
    setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  };

  const handleAnalyze = useCallback(async (title: string, text: string, name: string) => {
    setShowUpload(false);
    setAnalyzing(true);
    try {
      const res = await fetch('/api/analyze-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_title: title, materials: [{ name, kind: 'text', text }], mode: 'flash', language: 'it' }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setCaseData(await res.json());
    } catch (e) {
      alert(`Errore analisi: ${(e as Error).message}`);
    } finally {
      setAnalyzing(false);
    }
  }, []);

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

  const la = caseData.legal_analysis;

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
          {la && (
            <div className="risk-pill" style={{ background: riskColor(la.risk_level) + '22', border: `1px solid ${riskColor(la.risk_level)}55`, color: riskColor(la.risk_level) }}>
              {riskIcon(la.risk_level)} Rischio {riskLabel(la.risk_level)}
            </div>
          )}
        </div>
        <h1>{caseData.case_title}</h1>
        <p>{caseData.case_summary}</p>
        <div className="hero-actions">
          <button className="primary-button" onClick={() => setShowUpload(true)}>
            <Upload size={15} /> Carica materiale
          </button>
          <button className="secondary-button" onClick={() => { setActiveTab('legal'); scrollTo(timelineRef); }}>
            <Sparkles size={14} /> Analisi legale
          </button>
          <button className="aula-trigger-btn" onClick={() => setAulaModeActive(true)}>
            <Gavel size={14} /> Aula
          </button>
        </div>
      </section>

      {/* Stats */}
      <section className="stats-grid">
        <button className="stats-card" onClick={() => { scrollTo(materialsRef); }}>
          <FileText /><strong>{caseData.materials.length}</strong><span>materiali</span>
        </button>
        <button className="stats-card" onClick={() => { setActiveTab('timeline'); scrollTo(timelineRef); }}>
          <MapPin /><strong>{caseData.timeline.length}</strong><span>eventi</span>
        </button>
        <button className="stats-card" onClick={() => { setActiveTab('questions'); scrollTo(contradictionsRef); }}>
          <AlertTriangle /><strong>{caseData.contradictions.length}</strong><span>contraddizioni</span>
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
          {caseData.timeline.map((ev, i) => (
            <article className="timeline-item" key={i}>
              <div className="time-dot" />
              <div className="timeline-content">
                <p className="eyebrow">{ev.date} · {ev.time ?? 'orario da chiarire'} · confidenza {pct(ev.confidence)}</p>
                <h3>{ev.title}</h3>
                <p>{ev.description}</p>
                <SourceRow refs={ev.source_refs} onSelect={setSelectedSource} />
              </div>
            </article>
          ))}
        </section>
      )}

      {/* Deadlines */}
      {activeTab === 'deadlines' && (
        <section ref={deadlinesRef} className="panel deadline-list-panel">
          <h2><CalendarClock size={18} /> Agenda difensiva</h2>
          <p className="muted">Scadenze estratte dal fascicolo. Le candidate vanno confermate dal difensore prima di essere trattate come operative.</p>
          {caseData.procedural_deadlines.map((dl, i) => (
            <article className="deadline-item" key={i}>
              <div className="deadline-item-header">
                <div>
                  <p className="eyebrow">{deadlineTypeLabel(dl.deadline_type)} · urgenza {dl.urgency}</p>
                  <h3>{dl.title}</h3>
                </div>
                <span className={`status-chip ${dl.status}`}>{dl.status === 'confirmed' ? 'confermato' : dl.status === 'candidate' ? 'da confermare' : 'verifica'}</span>
              </div>
              <p className="deadline-date">{formatDateFull(dl.due_date)}{dl.due_time ? ` · ${dl.due_time}` : ''}</p>
              <p>{dl.description}</p>
              {(dl.start_work_date || dl.internal_target_date) && (
                <div className="workback-grid">
                  {dl.start_work_date && <div><span>Inizio lavori</span><strong>{formatDate(dl.start_work_date)}</strong></div>}
                  {dl.internal_target_date && <div><span>Target interno</span><strong>{formatDate(dl.internal_target_date)}</strong></div>}
                </div>
              )}
              <div className="task-progress">
                <div className="task-progress-bar">
                  <div className="task-progress-fill" style={{ width: `${dl.tasks.length ? (doneCount(dl.title, dl.tasks.length) / dl.tasks.length) * 100 : 0}%` }} />
                </div>
                <span>{doneCount(dl.title, dl.tasks.length)}/{dl.tasks.length} completati</span>
              </div>
              <ul className="task-list">
                {dl.tasks.map((t, ti) => (
                  <li key={ti} className={`task-item${isDone(dl.title, ti) ? ' task-done' : ''}`} onClick={() => toggleTask(dl.title, ti)}>
                    {isDone(dl.title, ti)
                      ? <CheckSquare size={15} className="task-icon task-icon-done" />
                      : <Square size={15} className="task-icon" />}
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <SourceRow refs={dl.source_refs} onSelect={setSelectedSource} />
            </article>
          ))}
        </section>
      )}

      {/* People & evidence */}
      {activeTab === 'facts' && (
        <section className="panel grid-panel">
          <div>
            <h2><Users size={18} /> Persone</h2>
            {caseData.people.map(p => (
              <article className="mini-card" key={p.name}>
                <h3>{p.name}</h3><p className="role">{p.role}</p><p>{p.notes}</p>
                <SourceRow refs={p.source_refs} onSelect={setSelectedSource} />
              </article>
            ))}
          </div>
          <div>
            <h2><Search size={18} /> Prove</h2>
            {caseData.evidence.map(ev => (
              <article className="mini-card" key={ev.title}>
                <h3>{ev.title}</h3><p className="role">{ev.status}</p><p>{ev.notes}</p>
                <SourceRow refs={ev.source_refs} onSelect={setSelectedSource} />
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Legal analysis */}
      {activeTab === 'legal' && (
        la
          ? <LegalAnalysisTab la={la} onSelectSource={setSelectedSource} onOpenChat={onOpenChat} />
          : <section className="panel"><p className="muted">Analisi legale non disponibile per questo fascicolo.</p></section>
      )}

      {/* Questions / contradictions */}
      {activeTab === 'questions' && (
        <section className="panel">
          <h2>Domande per colloquio / udienza</h2>
          {caseData.open_questions.map(q => (
            <article className="question-card" key={q.question}>
              <h3>{q.question}</h3><p>{q.why_it_matters}</p>
              <SourceRow refs={q.source_refs} onSelect={setSelectedSource} />
            </article>
          ))}
          <h2>Documenti mancanti</h2>
          {caseData.missing_documents.map(doc => (
            <article className="missing-card" key={doc.title}>
              <CheckCircle2 />
              <div><h3>{doc.title} <span>{doc.priority}</span></h3><p>{doc.reason}</p></div>
            </article>
          ))}
          <h2 ref={contradictionsRef}>Contraddizioni</h2>
          {caseData.contradictions.map(c => (
            <article className="question-card contradiction" key={c.title}>
              <h3>{c.title}</h3><p>{c.description}</p>
              <SourceRow refs={c.source_refs} onSelect={setSelectedSource} />
            </article>
          ))}
        </section>
      )}

      {/* Brief */}
      {activeTab === 'brief' && (
        <section className="panel brief-panel">
          <div className="brief-toolbar">
            <button className="brief-action-btn" onClick={exportBrief}><Copy size={14} /> Copia</button>
            <button className="brief-action-btn" onClick={shareBrief}><Share2 size={14} /> Condividi</button>
            <button className="brief-action-btn" onClick={() => setAulaModeActive(true)}><Gavel size={14} /> Aula Mode</button>
          </div>
          {markdownToLines(caseData.brief_markdown).map((line, i) => {
            if (line.startsWith('## ')) return <h2 key={i}>{line.slice(3)}</h2>;
            if (line.startsWith('### ')) return <h3 key={i}>{line.slice(4)}</h3>;
            if (line.startsWith('- ')) return <p className="bullet" key={i}>• {line.slice(2)}</p>;
            if (line.startsWith('**') && line.endsWith('**')) return <p key={i}><strong>{line.slice(2, -2)}</strong></p>;
            return <p key={i}>{line.replaceAll('**', '')}</p>;
          })}
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

      {/* Materials */}
      <section ref={materialsRef} className="materials-panel">
        <div className="materials-header">
          <h2>Materiali caricati</h2>
          <button className="upload-fab" onClick={() => setShowUpload(true)}><Plus size={16} /> Aggiungi</button>
        </div>
        {caseData.materials.map((m: Material) => (
          <button key={m.id} className="material-button" onClick={() => setSelectedMaterial(m)}>
            {m.kind === 'audio' ? <Mic size={17} /> : <FileText size={17} />}
            <div>
              <strong>{m.name}</strong>
              <p>{m.description}</p>
              <small>{m.excerpt}</small>
            </div>
          </button>
        ))}
      </section>

      <SourceDrawer source={selectedSource} onClose={() => setSelectedSource(null)} />
      <MaterialDrawer material={selectedMaterial} onClose={() => setSelectedMaterial(null)} />
      {showUpload && <UploadDrawer onClose={() => setShowUpload(false)} onAnalyze={handleAnalyze} />}
      {aulaModeActive && <AulaModeOverlay caseData={caseData} onClose={() => setAulaModeActive(false)} />}
      {toast && <ToastNotification message={toast.message} type={toast.type} onDismiss={dismissToast} />}
    </main>
  );
}

// ── Root app ─────────────────────────────────────────────────────────────────

type View = 'cases' | 'case';

const SYSTEM_PROMPT_IT = `Sei un assistente legale AI per avvocati penalisti italiani.

Hai padronanza approfondita di:
- Codice Penale (r.d. 19 ottobre 1930 n. 2441) e giurisprudenza applicativa
- Codice di Procedura Penale (d.P.R. 22 settembre 1988 n. 447) e disposizioni di attuazione
- Leggi speciali: Codice della Strada (d.lgs. 285/1992), T.U. Stupefacenti (d.P.R. 309/1990), d.lgs. 231/2001
- Giurisprudenza della Corte di Cassazione Penale (tutte le sezioni, orientamenti consolidati e recenti)
- Prassi processuale dei Tribunali italiani e tecniche difensive
- Giurisprudenza della Corte EDU su equo processo e diritti dell'imputato

Quando redigi atti processuali usa il formato standard italiano:
- Memorie: INTESTAZIONE, IN FATTO, IN DIRITTO, CONCLUSIONI
- Ricorsi Cassazione: motivi ex art. 606 c.p.p. con sezione e numero
- Eccezioni: norma violata, tipo di vizio (nullità/inutilizzabilità/inammissibilità), rimedio

Cita norme specifiche (art. X c.p. / art. X c.p.p.) e precedenti della Cassazione con sezione, numero e anno quando pertinenti. Scrivi in italiano giuridico formale. Questo è uno strumento professionale per avvocati: non aggiungere disclaimer o avvertenze.`;

function App() {
  const [view, setView] = useState<View>('cases');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [activeCaseData, setActiveCaseData] = useState<CaseAnalysis | null>(null);
  const [chat, setChat] = useState<ChatState>({ open: false, messages: [], caseContext: null });
  const [chatStreaming, setChatStreaming] = useState(false);

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
    setChat(prev => ({ ...prev, caseContext: buildCaseContext(data) }));
  }, []);

  const openChat = useCallback((initialKey?: string) => {
    if (initialKey && activeCaseData) {
      const ctx = buildCaseContext(activeCaseData);
      const promptFn = DOC_PROMPTS[initialKey];
      if (promptFn) {
        const userMsg: ChatMsg = { role: 'user', content: promptFn(ctx), id: crypto.randomUUID() };
        setChat(prev => ({ ...prev, open: true, messages: [...prev.messages, userMsg] }));
        sendToApi([...chat.messages, userMsg]);
        return;
      }
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

      const res = await fetch('/api/chat', {
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

  return (
    <>
      {view === 'case' && selectedCaseId
        ? <CaseDetailView caseId={selectedCaseId} onBack={handleBack} onOpenChat={openChat} onCaseLoaded={handleCaseLoaded} />
        : <CaseListView onSelect={handleSelectCase} />
      }
      <FloatingChatButton onClick={() => setChat(prev => ({ ...prev, open: !prev.open }))} hasContext={!!activeCaseData} />
      <ChatDrawer
        state={chat}
        onClose={() => setChat(prev => ({ ...prev, open: false }))}
        onSend={sendMessage}
        onQuickAction={openChat}
        streaming={chatStreaming}
      />
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
