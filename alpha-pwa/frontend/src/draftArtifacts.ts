export type DraftArtifactType = 'memoria' | 'cassazione' | 'eccezione' | 'crossExam' | 'strategy' | 'witnessCrossExam';
export type DraftArtifactStatus = 'draft' | 'reviewing' | 'approved' | 'archived';
export type DraftClaimStatus = 'sourced' | 'da_verificare' | 'unsupported';
export type DraftExportFormat = 'md' | 'txt' | 'html';

export type DraftClaimRef = {
  id: string;
  claim_text: string;
  source_refs: unknown[];
  quote_excerpt?: string;
  confidence: number;
  status: DraftClaimStatus;
};

export type DraftArtifact = {
  id: string;
  case_id: string;
  type: DraftArtifactType;
  title: string;
  status: DraftArtifactStatus;
  content_markdown: string;
  source_refs: unknown[];
  claim_refs: DraftClaimRef[];
  prompt: string;
  generation_notes: {
    model_mode: 'flash' | 'pro' | 'manual';
    used_redacted_context: boolean;
    warnings: string[];
    missing_info: string[];
    precedent_policy: 'no_invented_precedents';
  };
  created_at: string;
  updated_at: string;
  export_metadata?: {
    last_exported_at?: string;
    formats?: string[];
  };
};

export type CaseWithDraftArtifacts = {
  case_id: string;
  case_title: string;
  draft_artifacts?: DraftArtifact[];
  [key: string]: unknown;
};

export const DRAFT_PRECEDENT_GUARDRAIL = `

---
GUARDRAIL FONTI E PRECEDENTI
DIVIETO ASSOLUTO: non inventare precedenti giurisprudenziali.
Cita una sentenza solo se sei ragionevolmente certa dell'esistenza e dei dati minimi: Corte, sezione, numero, anno/data, principio rilevante.
Se non sei certa, NON citare numero o anno inventati. Scrivi invece: "Orientamento da verificare in banca dati prima del deposito" oppure "Giurisprudenza da ricercare/verificare".
Qualsiasi citazione Cassazione-like non supportata da fonte del fascicolo o memoria affidabile va marcata esplicitamente: DA VERIFICARE.
Non creare mai citazioni verosimili ma non verificate.
Per ogni affermazione fattuale sostanziale, collega la fonte se presente nel fascicolo; se manca, segnala che il punto è da verificare.
La bozza è materiale di lavoro: l'avvocato deve verificare fatti, norme, fonti, scadenze e precedenti prima del deposito.
`;

export const DRAFT_PLAINTEXT_EXPORT_WARNING = 'Questo file non è cifrato. Chiunque lo riceva o lo apra potrà leggerne il contenuto. Se vuoi proteggere il materiale con password, esporta l’intero fascicolo come .plt protetto.';

const DRAFT_LABELS: Record<DraftArtifactType, string> = {
  memoria: 'Memoria difensiva',
  cassazione: 'Ricorso Cassazione',
  eccezione: 'Eccezione procedurale',
  crossExam: 'Controesame',
  strategy: 'Analisi strategica',
  witnessCrossExam: 'Controesame testimone',
};

function randomId(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') return cryptoObj.randomUUID();
  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function safeSlug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    || 'bozza';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.split('\n');
  return lines.map(line => {
    if (line.startsWith('### ')) return `<h3>${escapeHtml(line.slice(4))}</h3>`;
    if (line.startsWith('## ')) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
    if (line.startsWith('# ')) return `<h1>${escapeHtml(line.slice(2))}</h1>`;
    if (line.trim().startsWith('- ')) return `<li>${escapeHtml(line.trim().slice(2))}</li>`;
    if (!line.trim()) return '';
    return `<p>${escapeHtml(line)}</p>`;
  }).join('\n');
}

export function draftTypeLabel(type: DraftArtifactType): string {
  return DRAFT_LABELS[type] ?? 'Bozza';
}

export function buildDraftPrompt<TCase>({
  caseData,
  type,
  promptTail,
  buildCaseContext,
  anonymized = false,
  extraInstruction = '',
  workspaceTitle = '',
}: {
  caseData: TCase;
  type: DraftArtifactType;
  promptTail: (ctx: string) => string;
  buildCaseContext: (caseData: TCase) => string;
  anonymized?: boolean;
  extraInstruction?: string;
  workspaceTitle?: string;
}): string {
  const ctx = buildCaseContext(caseData);
  const trimmedTitle = workspaceTitle.trim();
  const titleInstruction = trimmedTitle
    ? `TITOLO WORKSPACE / PROSSIMA PRIORITÀ: "${trimmedTitle}". La bozza deve riguardare precisamente questo titolo e usarlo come H1 Markdown iniziale: "# ${trimmedTitle}". Non sostituirlo con un'etichetta interna come "Analisi strategica" se il titolo utente è più specifico. Se il titolo non è sufficientemente chiaro o non capisci con sicurezza quale attività richieda, dillo esplicitamente all'inizio: "Non sono pienamente certa di cosa significhi la prossima priorità '${trimmedTitle}'; ecco la mia lettura operativa e, in subordine, un'analisi strategica da verificare." Poi procedi con la migliore interpretazione possibile senza inventare fatti.`
    : '';
  return [
    promptTail(ctx),
    titleInstruction,
    extraInstruction.trim(),
    anonymized ? 'CONTESTO PRIVACY: usa esclusivamente la versione anonimizzata del fascicolo.' : '',
    DRAFT_PRECEDENT_GUARDRAIL.trim(),
    `TIPO BOZZA: ${draftTypeLabel(type)}. Restituisci una bozza in Markdown editabile, con una sezione finale "Verifiche prima del deposito".`,
  ].filter(Boolean).join('\n\n');
}

export function createDraftArtifact<TCase extends { case_id: string }>({
  caseData,
  type,
  title,
  prompt,
  contentMarkdown = '',
  anonymized = false,
  warnings = [],
  missingInfo = [],
}: {
  caseData: TCase;
  type: DraftArtifactType;
  title?: string;
  prompt: string;
  contentMarkdown?: string;
  anonymized?: boolean;
  warnings?: string[];
  missingInfo?: string[];
}): DraftArtifact {
  const now = new Date().toISOString();
  return {
    id: randomId(),
    case_id: caseData.case_id,
    type,
    title: title || draftTypeLabel(type),
    status: 'draft',
    content_markdown: contentMarkdown,
    source_refs: [],
    claim_refs: [],
    prompt,
    generation_notes: {
      model_mode: 'flash',
      used_redacted_context: anonymized,
      warnings: [...warnings],
      missing_info: [...missingInfo],
      precedent_policy: 'no_invented_precedents',
    },
    created_at: now,
    updated_at: now,
  };
}

export function addDraftArtifact<TCase extends CaseWithDraftArtifacts>(caseData: TCase, artifact: DraftArtifact): TCase & { draft_artifacts: DraftArtifact[] } {
  return {
    ...caseData,
    draft_artifacts: [...(caseData.draft_artifacts ?? []), artifact],
  };
}

export function updateDraftArtifact<TCase extends CaseWithDraftArtifacts>(caseData: TCase, artifact: DraftArtifact): TCase & { draft_artifacts: DraftArtifact[] } {
  return {
    ...caseData,
    draft_artifacts: (caseData.draft_artifacts ?? []).map(existing => existing.id === artifact.id ? { ...artifact, updated_at: new Date().toISOString() } : existing),
  };
}

const CASSATION_CITATION_RE = /Cass\.?(?:azione)?\s*pen\.?(?:ale)?[^\n.;:]*?(?:sez\.\s*[A-ZIVX]+[^\n.;:]*)?(?:n\.\s*\d{1,6}\s*\/\s*\d{2,4}|\d{1,2}\s+[a-zà]+\s+\d{4})/gi;

export function flagUnverifiedCassationCitations(artifact: DraftArtifact): DraftArtifact {
  const matches = Array.from(new Set(artifact.content_markdown.match(CASSATION_CITATION_RE) ?? []));
  if (!matches.length) return artifact;

  let content = artifact.content_markdown;
  const existingClaims = [...artifact.claim_refs];
  const known = new Set(existingClaims.map(c => c.claim_text));

  for (const match of matches) {
    if (!known.has(match)) {
      existingClaims.push({
        id: randomId(),
        claim_text: match,
        source_refs: [],
        confidence: 0.2,
        status: 'da_verificare',
      });
      known.add(match);
    }
    const escaped = match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(${escaped})(?!\\s*\\[DA VERIFICARE\\])`, 'g');
    content = content.replace(re, '$1 [DA VERIFICARE]');
  }

  return {
    ...artifact,
    content_markdown: content,
    claim_refs: existingClaims,
    generation_notes: {
      ...artifact.generation_notes,
      warnings: Array.from(new Set([...artifact.generation_notes.warnings, 'Citazioni Cassazione-like non collegate a fonte marcate DA VERIFICARE.'])),
    },
    updated_at: new Date().toISOString(),
  };
}

export function exportDraftArtifact(artifact: DraftArtifact, format: DraftExportFormat): { filename: string; mime: string; content: string; warning: string } {
  const base = `${safeSlug(artifact.title)}-${artifact.id.slice(0, 8)}`;
  if (format === 'txt') {
    return {
      filename: `${base}.txt`,
      mime: 'text/plain;charset=utf-8',
      content: markdownToPlainText(artifact.content_markdown),
      warning: DRAFT_PLAINTEXT_EXPORT_WARNING,
    };
  }
  if (format === 'html') {
    return {
      filename: `${base}.html`,
      mime: 'text/html;charset=utf-8',
      content: `<!doctype html>\n<html lang="it"><head><meta charset="utf-8"><title>${escapeHtml(artifact.title)}</title><style>body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6;max-width:860px;margin:40px auto;padding:0 20px;color:#111827}h1,h2,h3{color:#111827}.warning{border:1px solid #f59e0b;background:#fffbeb;color:#92400e;padding:12px;border-radius:10px}</style></head><body><p class="warning">${escapeHtml(DRAFT_PLAINTEXT_EXPORT_WARNING)}</p>${markdownToHtml(artifact.content_markdown)}</body></html>`,
      warning: DRAFT_PLAINTEXT_EXPORT_WARNING,
    };
  }
  return {
    filename: `${base}.md`,
    mime: 'text/markdown;charset=utf-8',
    content: artifact.content_markdown,
    warning: DRAFT_PLAINTEXT_EXPORT_WARNING,
  };
}
