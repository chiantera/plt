import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertTriangle, ArrowRight, BriefcaseBusiness, CalendarClock, CheckCircle2, FileText, Gavel, Loader2, MapPin, Search, ShieldCheck, Sparkles, Users } from 'lucide-react';
import './styles.css';

type SourceRef = {
  source_name: string;
  page: number | null;
  chunk: string | null;
  quote: string;
  confidence: number;
};

type Material = {
  id: string;
  name: string;
  kind: string;
  description: string;
  excerpt: string;
};

type TimelineEvent = {
  date: string | null;
  time: string | null;
  title: string;
  description: string;
  source_refs: SourceRef[];
  confidence: number;
};

type Person = {
  name: string;
  role: string;
  notes: string;
  source_refs: SourceRef[];
};

type EvidenceItem = {
  title: string;
  status: string;
  notes: string;
  source_refs: SourceRef[];
};

type OpenQuestion = {
  question: string;
  why_it_matters: string;
  source_refs: SourceRef[];
};

type MissingDocument = {
  title: string;
  reason: string;
  priority: 'alta' | 'media' | 'bassa';
};

type Contradiction = {
  title: string;
  description: string;
  source_refs: SourceRef[];
};

type ProceduralDeadline = {
  title: string;
  deadline_type: 'hearing' | 'defense_brief' | 'filing' | 'investigation' | 'other';
  due_date: string;
  due_time: string | null;
  status: 'confirmed' | 'candidate' | 'needs_review';
  urgency: 'alta' | 'media' | 'bassa';
  description: string;
  start_work_date: string | null;
  internal_target_date: string | null;
  source_refs: SourceRef[];
  tasks: string[];
};

type UsageEstimate = {
  pages: number;
  audio_minutes: number;
  flash_input_tokens: number;
  flash_output_tokens: number;
  pro_used: boolean;
  model_route: string;
};

type CaseAnalysis = {
  case_id: string;
  case_title: string;
  language: 'it';
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
};

type TabId = 'timeline' | 'deadlines' | 'facts' | 'questions' | 'brief';

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'deadlines', label: 'Scadenze' },
  { id: 'facts', label: 'Persone & prove' },
  { id: 'questions', label: 'Da verificare' },
  { id: 'brief', label: 'Promemoria' },
];

function confidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function markdownToLines(markdown: string): string[] {
  return markdown.split('\n').filter((line) => line.trim().length > 0);
}

function formatDate(value: string | null): string {
  if (!value) return 'da definire';
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

function deadlineTypeLabel(type: ProceduralDeadline['deadline_type']): string {
  const labels: Record<ProceduralDeadline['deadline_type'], string> = {
    hearing: 'udienza',
    defense_brief: 'memoria difensiva',
    filing: 'deposito',
    investigation: 'indagine difensiva',
    other: 'altro',
  };
  return labels[type];
}

function SourceBadge({ refItem, onSelect }: { refItem: SourceRef; onSelect: (source: SourceRef) => void }) {
  return (
    <button className="source-badge" onClick={() => onSelect(refItem)}>
      <FileText size={13} />
      {refItem.source_name} · fonte {confidence(refItem.confidence)}
    </button>
  );
}

function SourceDrawer({ source, onClose }: { source: SourceRef | null; onClose: () => void }) {
  if (!source) return null;
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="source-drawer" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-handle" />
        <div className="drawer-header">
          <div>
            <p className="eyebrow">Fonte collegata</p>
            <h2>{source.source_name}</h2>
          </div>
          <button onClick={onClose} className="ghost-button">Chiudi</button>
        </div>
        <blockquote>“{source.quote}”</blockquote>
        <div className="drawer-meta">
          <span>Pagina {source.page ?? 1}</span>
          <span>Chunk {source.chunk ?? 'demo'}</span>
          <span>Confidenza {confidence(source.confidence)}</span>
        </div>
      </aside>
    </div>
  );
}

function Skeleton() {
  return (
    <main className="app-shell loading-shell">
      <Loader2 className="spin" />
      <p>Carico fascicolo demo italiano…</p>
    </main>
  );
}

function App() {
  const [caseData, setCaseData] = useState<CaseAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('timeline');
  const [selectedSource, setSelectedSource] = useState<SourceRef | null>(null);

  useEffect(() => {
    fetch('/api/demo-case')
      .then((response) => {
        if (!response.ok) throw new Error(`Errore backend: ${response.status}`);
        return response.json() as Promise<CaseAnalysis>;
      })
      .then(setCaseData)
      .catch((err: Error) => setError(err.message));
  }, []);

  const nextDeadline = useMemo(() => {
    return [...(caseData?.procedural_deadlines ?? [])].sort((a, b) => {
      const aStamp = `${a.due_date}T${a.due_time ?? '23:59'}`;
      const bStamp = `${b.due_date}T${b.due_time ?? '23:59'}`;
      return aStamp.localeCompare(bStamp);
    })[0];
  }, [caseData]);

  if (error) {
    return (
      <main className="app-shell loading-shell">
        <AlertTriangle />
        <h1>Backend non raggiungibile</h1>
        <p>{error}</p>
        <p className="muted">Avvia il backend FastAPI e ricarica.</p>
      </main>
    );
  }

  if (!caseData) return <Skeleton />;

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div className="hero-topline">
          <span><Gavel size={15} /> Pocket Legal Triage Alpha</span>
          <span className="pill"><Sparkles size={14} /> {caseData.usage_estimate.model_route}</span>
        </div>
        <h1>{caseData.case_title}</h1>
        <p>{caseData.case_summary}</p>
        <div className="hero-actions">
          <button className="primary-button">Processa nuovo materiale <ArrowRight size={16} /></button>
          <button className="secondary-button">Analisi profonda Pro</button>
        </div>
      </section>

      <section className="stats-grid">
        <article>
          <FileText />
          <strong>{caseData.materials.length}</strong>
          <span>materiali</span>
        </article>
        <article>
          <MapPin />
          <strong>{caseData.timeline.length}</strong>
          <span>eventi</span>
        </article>
        <article>
          <AlertTriangle />
          <strong>{caseData.contradictions.length}</strong>
          <span>contraddizioni</span>
        </article>
        <article>
          <BriefcaseBusiness />
          <strong>{nextDeadline?.due_time ?? '—'}</strong>
          <span>prossima</span>
        </article>
      </section>

      <section className="deadline-card">
        <div>
          <p className="eyebrow">Prossimo atto</p>
          <h2>{nextDeadline?.title}</h2>
          <p>{nextDeadline ? `${formatDate(nextDeadline.due_date)}${nextDeadline.due_time ? ` · ${nextDeadline.due_time}` : ''} · ${nextDeadline.status === 'confirmed' ? 'confermato' : 'da confermare'}` : 'Nessuna scadenza caricata'}</p>
          <p>{nextDeadline?.description}</p>
        </div>
        <ShieldCheck className="deadline-icon" />
      </section>

      <nav className="tab-bar">
        {tabs.map((tab) => (
          <button key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'timeline' && (
        <section className="panel timeline-panel">
          {caseData.timeline.map((event) => (
            <article className="timeline-item" key={`${event.date}-${event.time}-${event.title}`}>
              <div className="time-dot" />
              <div className="timeline-content">
                <p className="eyebrow">{event.date} · {event.time ?? 'orario da chiarire'} · confidenza {confidence(event.confidence)}</p>
                <h3>{event.title}</h3>
                <p>{event.description}</p>
                <div className="source-row">{event.source_refs.map((source) => <SourceBadge key={source.quote} refItem={source} onSelect={setSelectedSource} />)}</div>
              </div>
            </article>
          ))}
        </section>
      )}

      {activeTab === 'deadlines' && (
        <section className="panel deadline-list-panel">
          <h2><CalendarClock size={18} /> Scadenze & calendario difensivo</h2>
          <p className="muted">Date estratte dal fascicolo. Le scadenze candidate vanno confermate dal difensore prima di essere trattate come operative.</p>
          {caseData.procedural_deadlines.map((item) => (
            <article className="deadline-item" key={`${item.due_date}-${item.title}`}>
              <div className="deadline-item-header">
                <div>
                  <p className="eyebrow">{deadlineTypeLabel(item.deadline_type)} · urgenza {item.urgency}</p>
                  <h3>{item.title}</h3>
                </div>
                <span className={`status-chip ${item.status}`}>{item.status === 'confirmed' ? 'confermato' : item.status === 'candidate' ? 'da confermare' : 'verifica'}</span>
              </div>
              <p className="deadline-date">{formatDate(item.due_date)}{item.due_time ? ` · ${item.due_time}` : ''}</p>
              <p>{item.description}</p>
              <div className="workback-grid">
                <div>
                  <span>Inizia</span>
                  <strong>{formatDate(item.start_work_date)}</strong>
                </div>
                <div>
                  <span>Target interno</span>
                  <strong>{formatDate(item.internal_target_date)}</strong>
                </div>
              </div>
              <ul className="task-list">
                {item.tasks.map((task) => <li key={task}>{task}</li>)}
              </ul>
              <div className="source-row">{item.source_refs.map((source) => <SourceBadge key={source.quote} refItem={source} onSelect={setSelectedSource} />)}</div>
            </article>
          ))}
        </section>
      )}

      {activeTab === 'facts' && (
        <section className="panel grid-panel">
          <div>
            <h2><Users size={18} /> Persone</h2>
            {caseData.people.map((person) => (
              <article className="mini-card" key={person.name}>
                <h3>{person.name}</h3>
                <p className="role">{person.role}</p>
                <p>{person.notes}</p>
                <div className="source-row">{person.source_refs.map((source) => <SourceBadge key={source.quote} refItem={source} onSelect={setSelectedSource} />)}</div>
              </article>
            ))}
          </div>
          <div>
            <h2><Search size={18} /> Prove</h2>
            {caseData.evidence.map((item) => (
              <article className="mini-card" key={item.title}>
                <h3>{item.title}</h3>
                <p className="role">{item.status}</p>
                <p>{item.notes}</p>
                <div className="source-row">{item.source_refs.map((source) => <SourceBadge key={source.quote} refItem={source} onSelect={setSelectedSource} />)}</div>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'questions' && (
        <section className="panel">
          <h2>Domande per colloquio / udienza</h2>
          {caseData.open_questions.map((item) => (
            <article className="question-card" key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.why_it_matters}</p>
              <div className="source-row">{item.source_refs.map((source) => <SourceBadge key={source.quote} refItem={source} onSelect={setSelectedSource} />)}</div>
            </article>
          ))}
          <h2>Documenti mancanti</h2>
          {caseData.missing_documents.map((doc) => (
            <article className="missing-card" key={doc.title}>
              <CheckCircle2 />
              <div>
                <h3>{doc.title} <span>{doc.priority}</span></h3>
                <p>{doc.reason}</p>
              </div>
            </article>
          ))}
          <h2>Contraddizioni</h2>
          {caseData.contradictions.map((item) => (
            <article className="question-card contradiction" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <div className="source-row">{item.source_refs.map((source) => <SourceBadge key={source.quote} refItem={source} onSelect={setSelectedSource} />)}</div>
            </article>
          ))}
        </section>
      )}

      {activeTab === 'brief' && (
        <section className="panel brief-panel">
          {markdownToLines(caseData.brief_markdown).map((line) => {
            if (line.startsWith('## ')) return <h2 key={line}>{line.replace('## ', '')}</h2>;
            if (line.startsWith('### ')) return <h3 key={line}>{line.replace('### ', '')}</h3>;
            if (line.startsWith('- ')) return <p className="bullet" key={line}>• {line.replace('- ', '')}</p>;
            return <p key={line}>{line.replaceAll('**', '')}</p>;
          })}
          <div className="usage-box">
            <p className="eyebrow">Stima processamento</p>
            <p>{caseData.usage_estimate.pages} pagine · {caseData.usage_estimate.audio_minutes} min audio · Flash in/out {caseData.usage_estimate.flash_input_tokens}/{caseData.usage_estimate.flash_output_tokens} token · Pro usato: {caseData.usage_estimate.pro_used ? 'sì' : 'no'}</p>
          </div>
        </section>
      )}

      <section className="materials-panel">
        <h2>Materiali caricati</h2>
        {caseData.materials.map((material) => (
          <article key={material.id}>
            <FileText size={17} />
            <div>
              <strong>{material.name}</strong>
              <p>{material.description}</p>
              <small>{material.excerpt}</small>
            </div>
          </article>
        ))}
      </section>

      <SourceDrawer source={selectedSource} onClose={() => setSelectedSource(null)} />
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
