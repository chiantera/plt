import React, { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertTriangle, ArrowLeft, ArrowRight, BookOpen,
  CalendarClock, CheckCircle2, CheckSquare, ChevronDown, ChevronRight,
  Clock, Copy, Eye, EyeOff, FileText, FolderPlus, Gavel, Loader2, MessageSquare, Mic, Plus, RefreshCw,
  Globe, Scale, Search, Send, Share2, ShieldAlert, ShieldCheck, ShieldOff, Sparkles,
  Square, Trash2, Upload, Users, X, Zap, FolderOpen,
} from 'lucide-react';

const MultiFileUploadDrawer = React.lazy(() => import('./components/MultiFileUploadDrawer'));
const CaseDetailView = React.lazy(() => import('./screens/CaseDetailView'));
import { ChatDrawer, FloatingChatButton, FabRestoreButton } from './components/ChatPanel';
import GiuliaPromptBar from './components/GiuliaPromptBar';
import AccountControls from './components/AccountControls';
import { resumePersistedAnalyses, runningAnalysisCount, getAnalysisState, useAnalysisTick } from './analysis/analysisManager';
import LockGate from './lock/LockGate';
import './lock/lock.css';
import OnboardingWizard from './onboarding/OnboardingWizard';
import { wizardBus, isOnboardingActive } from './onboarding/wizardBus';
import './tokens.css';
import './styles.css';
import { API } from './config';
import { riskColor, riskIcon, riskLabel } from './domain/helpers';
import { formatDate, formatDateFull, formatShortDate } from './dateUtils';
import { dbSave, dbList, dbGet, dbDelete, dbClaimLegacyCases, localOwnerIdFromSession } from './db';
import { installMockApi } from './data/mockApi';
import { decryptPltContainer, exportEncryptedPlt, exportPlainPlt, parsePltFile } from './pltExport';
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
} from './draftArtifacts';
import { type Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { DOC_PROMPTS } from './prompts/documentDrafts';
import { REDACT_APPLY_PROMPT, REDACT_DETECT_PROMPT } from './prompts/redaction';
import { SYSTEM_PROMPT_IT } from './prompts/giulia';
import { buildCaseContext, caseAnalysisToSummary } from './domain/caseContext';
import { buildUserContextMaterial, mergeWithAi } from './domain/caseMerge';
import { applyRedactionToCase, mergeRedactionRules } from './domain/redaction';
import type {
  CaseAnalysis,
  CaseSummary,
  ChargeAnalysis,
  ChargeElement,
  ChatMsg,
  ChatState,
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
  WitnessAssessment,
} from './domain/types';
const DEV_BYPASS_AUTH =
  import.meta.env.VITE_BYPASS_AUTH === 'true' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname);

if (import.meta.env.VITE_MOCK_DATA === 'true') installMockApi();

// ── Domain helpers ───────────────────────────────────────────────────────────

function NewCaseDrawer({ onClose, onCreate, clientNameMode = false }: { onClose: () => void; onCreate: (title: string) => void; clientNameMode?: boolean }) {
  const [value, setValue] = useState('');
  // In onboarding, ask for the client name and derive the case title "Caso <nome>".
  const titleFor = (v: string) => clientNameMode ? `Caso ${v.trim()}` : v.trim();
  const submit = () => { if (value.trim()) onCreate(titleFor(value)); };
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="source-drawer upload-drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-handle" />
        <div className="drawer-header">
          <div><p className="eyebrow">Fascicolo</p><h2>Nuovo fascicolo</h2></div>
          <button title="Chiudi o annulla" onClick={onClose} className="ghost-button"><X size={18} /></button>
        </div>
        <div className="upload-field">
          <label>{clientNameMode ? 'Nome del cliente' : 'Titolo del caso'}</label>
          <input
            className="upload-input"
            data-tour={clientNameMode ? 'client-name' : undefined}
            placeholder={clientNameMode ? 'es. Sig. Rossi (anche pseudonimo o soprannome)' : 'es. Caso Rossi — Furto aggravato'}
            value={value}
            autoFocus
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          />
          {clientNameMode && value.trim() && (
            <p className="muted" style={{ marginTop: 6, fontSize: '0.82rem' }}>Il fascicolo si chiamerà «Caso {value.trim()}».</p>
          )}
        </div>
        <div className="upload-actions">
          <button className="ghost-button" onClick={onClose} title="Annulla operazione">Annulla</button>
          <button title="Conferma operazione principale" className="primary-button" disabled={!value.trim()} onClick={submit}>
            <FolderPlus size={15} /> Crea fascicolo
          </button>
        </div>
      </aside>
    </div>
  );
}

// MultiFileUploadDrawer → src/components/MultiFileUploadDrawer.tsx (lazy-loaded)

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
        <span className="home-stat-value" style={{ color: critical > 0 ? 'var(--critical)' : 'var(--success)' }}>{critical}</span>
        <span className="home-stat-label">alto rischio</span>
      </div>
      <div className="home-stat-divider" />
      <div className="home-stat">
        <span className="home-stat-value" style={{ color: upcoming > 0 ? 'var(--warning)' : 'var(--ink-4)' }}>{upcoming}</span>
        <span className="home-stat-label">scadenze attive</span>
      </div>
      <div className="home-stat-divider" />
      <div className="home-stat">
        <span className="home-stat-value" style={{ color: totalContradictions > 0 ? 'var(--warning)' : 'var(--ink-4)' }}>{totalContradictions}</span>
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
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') setSession(null);
      });
      return () => subscription.unsubscribe();
    }

    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);
  return session;
}

const AUTH_TOUR_KEY = 'plt:auth-tour:dismissed';

/** First-run welcome panel on the login page. Reuses the wizard's `.tour-*`
 *  look. Guides the user: read the warning → tick the box → sign in / sign up.
 *  ✕ / "Ho capito" close for this visit; "Non mostrare più" persists. */
function AuthTour() {
  const [show, setShow] = useState(() => {
    try { return localStorage.getItem(AUTH_TOUR_KEY) !== '1'; } catch { return false; }
  });
  if (!show) return null;
  const close = () => setShow(false);
  const never = () => {
    try { localStorage.setItem(AUTH_TOUR_KEY, '1'); } catch {}
    setShow(false);
  };
  return (
    <div className="auth-tour-backdrop" role="dialog" aria-modal="true" aria-labelledby="auth-tour-title">
      <div className="tour-tooltip auth-tour-panel">
        <button type="button" className="tour-close" aria-label="Chiudi" onClick={close}>✕</button>
        <h3 className="tour-title" id="auth-tour-title">Benvenuto in PLT 👋</h3>
        <p className="tour-body">Prima di entrare, tre passaggi rapidi:</p>
        <ol className="auth-tour-steps">
          <li>Leggi l'<strong>avvertimento</strong> qui a fianco (responsabilità professionale e privacy).</li>
          <li>Spunta «<strong>Ho letto e compreso</strong>».</li>
          <li><strong>Accedi</strong> o <strong>registrati</strong> con la tua email.</li>
        </ol>
        <button type="button" className="auth-tour-ok" onClick={close}>Ho capito, iniziamo</button>
        <label className="tour-dontshow">
          <input type="checkbox" onChange={e => { if (e.target.checked) never(); }} />
          Non mostrare più
        </label>
      </div>
    </div>
  );
}

function AuthScreen() {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accepted) return;
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
      <AuthTour />
      <div className="auth-shell">
        <div className="auth-col">
          <div className="auth-disclaimer auth-disclaimer--card" role="note">
            <p><strong>Importante:</strong> PLT aiuta a organizzare fascicoli, bozze e checklist. Non sostituisce il giudizio dell'avvocato: ogni termine, fonte, precedente o citazione resta da verificare prima dell'uso.</p>
            <p><strong>Privacy:</strong> carica solo materiali che puoi trattare. Usa anonimizzazione o pseudonimi quando opportuno; le chiamate AI/OCR/STT sono superfici di trasferimento dati esterne.</p>
            <label className="auth-accept">
              <input
                type="checkbox"
                checked={accepted}
                onChange={e => setAccepted(e.target.checked)}
              />
              <span>Ho letto e compreso: PLT produce materiale di lavoro da verificare, non decisioni.</span>
            </label>
            {!accepted && <p className="auth-accept-hint">Spunta la casella per accedere o creare un account.</p>}
          </div>

          <div className="auth-card" data-tour="auth-card">
            <div className="auth-card-kicker">Accesso riservato</div>
            <div className="auth-tabs">
              {(['login', 'signup'] as const).map(t => (
                <button title="Cambia modalità di accesso" key={t} className={`auth-tab${tab === t ? ' auth-tab--active' : ''}`} onClick={() => setTab(t)}>
                  {t === 'login' ? 'Accedi' : 'Registrati'}
                </button>
              ))}
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              <input className="auth-input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
              <input className="auth-input" type="password" placeholder="Password (min. 6 caratteri)" value={password} onChange={e => setPassword(e.target.value)} required />
              {error && <div className="auth-error">{error}</div>}
              {info && <div className="auth-info">{info}</div>}
              <button className="auth-submit" title="Conferma dati di accesso" type="submit" disabled={loading || !accepted}>
                {loading ? 'Caricamento…' : tab === 'login' ? 'Accedi' : 'Crea account'}
              </button>
            </form>
          </div>
        </div>

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
      </div>
    </div>
  );
}

// ── Case list ─────────────────────────────────────────────────────────────────

function CaseListView({ onSelect, session, onOpenChat }: { onSelect: (id: string) => void; session: Session; onOpenChat: (msg?: string) => void }) {
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [localIds, setLocalIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [warming, setWarming] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [search, setSearch] = useState('');
  const [profileTagline, setProfileTagline] = useState<string | null>(null);
  const localOwnerId = useMemo(() => localOwnerIdFromSession(session), [session]);
  useAnalysisTick(); // re-render this list as background analyses start/finish

  useEffect(() => {
    supabase.from('profiles').select('full_name,studio').eq('id', session.user.id).single()
      .then(({ data }) => {
        if (data) setProfileTagline(data.studio || data.full_name || null);
      });
  }, [session.user.id]);

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
      await dbClaimLegacyCases(localOwnerId);
      const local = (await dbList(localOwnerId)) as CaseAnalysis[];
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
  }, [localOwnerId]);

  const handleCreate = useCallback(async (title: string) => {
    const newCase: CaseAnalysis = {
      case_id: crypto.randomUUID(), case_title: title, is_pending: true, raw_documents: [],
      language: 'it', case_summary: '', materials: [], timeline: [], people: [],
      evidence: [], open_questions: [], missing_documents: [], contradictions: [],
      procedural_deadlines: [], brief_markdown: '', usage_estimate: { pages: 0, audio_minutes: 0, flash_input_tokens: 0, flash_output_tokens: 0, pro_used: false, model_route: '' }, legal_analysis: null,
    };
    try {
      await dbSave(localOwnerId, newCase);
    } catch (e) {
      setError(`Errore creazione fascicolo: ${(e as Error).message}`);
      return;
    }
    setShowUpload(false);
    setCases(prev => {
      const summary = caseAnalysisToSummary(newCase);
      return prev ? [summary, ...prev] : [summary];
    });
    setLocalIds(prev => new Set([...prev, newCase.case_id]));
    onSelect(newCase.case_id);
  }, [localOwnerId, onSelect]);

  const openNewCase = useCallback(() => {
    setShowUpload(true);
    wizardBus.emit('new-case-drawer-opened');
  }, []);

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Eliminare il fascicolo? I dati sono conservati solo sul tuo dispositivo.')) return;
    await dbDelete(localOwnerId, id);
    setCases(prev => prev?.filter(c => c.case_id !== id) ?? null);
    setLocalIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  }, [localOwnerId]);

  return (
    <main className="app-shell home-shell">

      {/* ── Hero ── */}
      <header className="home-hero">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="home-brand">
            <div className="home-brand-icon"><Gavel size={22} /></div>
            <div>
              <div className="home-brand-name">Pocket Legal Triage</div>
              <div className="home-brand-tagline">{profileTagline ?? 'Il tuo studio'}</div>
            </div>
          </div>
          <AccountControls session={session} />
        </div>
        <h1 className="home-headline">
          I miei <span className="home-headline-accent">fascicoli</span>
        </h1>
        {cases && <HomepageStats cases={cases} />}
      </header>

      {/* ── GiulIA inline prompt ── */}
      <GiuliaPromptBar onOpenChat={onOpenChat} />

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
            {search && <button className="cases-search-clear" title="Azzera ricerca" onClick={() => setSearch('')}><X size={14} /></button>}
          </div>
        )}
        <button className="primary-button home-new-btn" data-tour="new-case" title="Crea un nuovo fascicolo vuoto" onClick={openNewCase}>
          <Plus size={15} /> Nuovo fascicolo
        </button>
        <button title="Esegui azione" className="secondary-button" onClick={() => document.getElementById('import-file-input')?.click()}>
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
              const parsed = await parsePltFile<CaseAnalysis>(text);
              let data: CaseAnalysis;
              if (parsed.kind === 'encrypted') {
                const password = prompt('Fascicolo protetto\n\nQuesto file .plt è cifrato. Inserisci la password usata al momento dell’esportazione.');
                if (!password) throw new Error('Importazione annullata');
                data = await decryptPltContainer<CaseAnalysis>(parsed.container, password);
              } else {
                if (!confirm('Questo .plt non è protetto da password. Importalo solo se proviene da una fonte affidabile.\n\nContinuare?')) {
                  throw new Error('Importazione annullata');
                }
                data = parsed.caseData;
              }
              if (!data.case_id || !data.case_title) throw new Error('File non valido');
              const existing = await dbGet(localOwnerId, data.case_id);
              if (existing) {
                const action = confirm(
                  `Il fascicolo "${data.case_title}" è già presente. \n\nOK = Sostituisci\nAnnulla = Salva come copia`
                );
                if (!action) {
                  data.case_id = crypto.randomUUID();
                  data.case_title += ' (importato)';
                }
              }
              await dbSave(localOwnerId, data as CaseAnalysis);
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
        {filtered.length === 0 && cases && cases.length > 0 && (
          <p className="muted" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '32px 0' }}>
            Nessun fascicolo corrisponde a &ldquo;{search}&rdquo;
          </p>
        )}
        {cases && cases.length === 0 && (
          <div className="empty-state empty-state-placeholder lg" style={{ gridColumn: '1/-1' }}>
            <FolderOpen size={48} style={{ color: 'var(--ink-5)', marginBottom: 16 }} />
            <h3 style={{ fontSize: '1.2rem', color: 'var(--ink-1)', marginBottom: 8 }}>Nessun fascicolo presente</h3>
            <p className="muted" style={{ maxWidth: 400, margin: '0 auto 24px', lineHeight: 1.5 }}>
              Inizia creando un nuovo fascicolo vuoto per analizzare documenti, oppure importa un file <code>.plt</code> protetto.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="primary-button" data-tour="new-case" onClick={openNewCase} title="Crea un nuovo fascicolo vuoto">
                <Plus size={15} /> Nuovo Fascicolo
              </button>
            </div>
          </div>
        )}
        {filtered.map(c => (
          <button key={c.case_id} title="Apri il fascicolo per visualizzare dettagli e documenti" className={`case-card${localIds.has(c.case_id) ? ' case-card-local' : ''}`} onClick={() => onSelect(c.case_id)}>
            <div className="case-card-header">
              <div className="case-card-risk" style={{ background: riskColor(c.risk_level) + '22', border: `1px solid ${riskColor(c.risk_level)}55` }}>
                <span style={{ color: riskColor(c.risk_level) }}>{riskIcon(c.risk_level)} {riskLabel(c.risk_level)}</span>
              </div>
              <div className="case-card-actions">
                {localIds.has(c.case_id) && (
                  <span className="case-local-badge">locale</span>
                )}
                {localIds.has(c.case_id) && (
                  <button className="case-delete-btn" onClick={e => handleDelete(c.case_id, e)} title="Elimina fascicolo" type="button">
                    <Trash2 size={14} />
                  </button>
                )}
                <ChevronRight size={18} className="case-card-arrow" />
              </div>
            </div>
            <h3 className="case-card-title">{c.case_title}</h3>
            {getAnalysisState(c.case_id)?.status === 'running' && (
              <span className="case-analyzing-pill"><Loader2 size={12} className="spin" /> Analisi in corso…</span>
            )}
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

      {showUpload && <NewCaseDrawer onClose={() => setShowUpload(false)} onCreate={handleCreate} clientNameMode={isOnboardingActive()} />}
    </main>
  );
}


// ── Root app ─────────────────────────────────────────────────────────────────

type View = 'cases' | 'case';

function App() {
  const session = useAuth();
  // Warm up the Render backend the moment the app loads (free-tier instances
  // cold-start in ~30-50s). Fire-and-forget so nothing blocks; by the time the
  // user reads the disclaimer, logs in, and opens a case, the backend is awake.
  useEffect(() => { fetch(`${API}/api/health`).catch(() => {}); }, []);
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
  const [fabHidden, setFabHidden] = useState(() => {
    try { return sessionStorage.getItem('plt_fab_hidden') === '1'; } catch { return false; }
  });

  const hideFab = useCallback(() => {
    setFabHidden(true);
    try { sessionStorage.setItem('plt_fab_hidden', '1'); } catch {}
  }, []);

  const restoreFab = useCallback(() => {
    setFabHidden(false);
    try { sessionStorage.removeItem('plt_fab_hidden'); } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('plt_chat_messages', JSON.stringify(chat.messages)); } catch {}
  }, [chat.messages]);

  // Resume any analysis job that was running before a refresh / app restart.
  useEffect(() => { resumePersistedAnalyses(); }, []);

  // Refresh the case list whenever a background analysis finishes, so updated
  // cards show even if the user is sitting on the list while it completes.
  const analysisTick = useAnalysisTick();
  const prevRunningRef = useRef(runningAnalysisCount());
  useEffect(() => {
    const n = runningAnalysisCount();
    if (n < prevRunningRef.current) setListRefreshKey(k => k + 1);
    prevRunningRef.current = n;
  }, [analysisTick]);

  const handleSelectCase = useCallback((id: string) => {
    if (id !== selectedCaseId) {
      // Different case: reset context and swap
      setSelectedCaseId(id);
      setActiveCaseData(null);
      setChat(prev => ({ ...prev, caseContext: null }));
    }
    setView('case');
  }, [selectedCaseId]);

  const handleBack = useCallback(() => {
    // Only change view — keep CaseDetailView mounted so a background analysis
    // can complete and save to IndexedDB without losing state on remount.
    setView('cases');
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
    if (initialKeyOrText) {
      const ctx = activeCaseData ? buildCaseContext(activeCaseData) : null;
      const promptFn = DOC_PROMPTS[initialKeyOrText as keyof typeof DOC_PROMPTS];
      const content = ctx
        ? (promptFn ? promptFn(ctx) : `${ctx}\n\n---\n${initialKeyOrText}`)
        : initialKeyOrText;
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
          m.id === assistantId && m.role === 'assistant' && m.content === ''
            ? { ...m, content: `Errore: ${(e as Error).message}` }
            : m
        ),
      }));
    } finally {
      setChatStreaming(false);
    }
  }, [activeCaseData]);

  if (session === undefined) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)' }}>
      <Loader2 size={28} className="spin" style={{ color: 'var(--giulia-ink)' }} />
    </div>
  );

  return (
    <>
      {session ? (
        <LockGate session={session}>
          {/* Keep both views mounted; hide the inactive one so background analysis survives navigation */}
          <div style={view === 'case' ? { display: 'none' } : undefined}>
            <CaseListView key={listRefreshKey} onSelect={handleSelectCase} session={session} onOpenChat={openChat} />
          </div>
          {selectedCaseId && (
            <div style={view !== 'case' ? { display: 'none' } : undefined}>
              <Suspense fallback={<div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)' }}><Loader2 size={28} className="spin" style={{ color: 'var(--giulia-ink)' }} /></div>}>
                <CaseDetailView key={selectedCaseId} caseId={selectedCaseId} session={session} onBack={handleBack} onOpenChat={openChat} onCaseLoaded={handleCaseLoaded} onCaseAnalyzed={() => setListRefreshKey(k => k + 1)} />
              </Suspense>
            </div>
          )}
          {fabHidden
            ? <FabRestoreButton onRestore={restoreFab} />
            : <FloatingChatButton onClick={() => setChat(prev => ({ ...prev, open: !prev.open }))} hasContext={!!activeCaseData} onHide={hideFab} />
          }
          <ChatDrawer
            state={chat}
            onClose={() => setChat(prev => ({ ...prev, open: false }))}
            onSend={sendMessage}
            onQuickAction={openChat}
            onClear={() => setChat(prev => ({ ...prev, messages: [] }))}
            streaming={chatStreaming}
          />
        </LockGate>
      ) : (
        <AuthScreen />
      )}
      <OnboardingWizard view={session ? view : 'auth'} />
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
