/**
 * analysisManager — owns the lifecycle of background AI analyses, independent of
 * which screen is mounted. Analyses run as backend *jobs*: we POST once, store
 * the job_id, and poll until done/error. This survives:
 *   - navigating back to the case list or opening another case (the manager
 *     lives at module scope, not inside CaseDetailView);
 *   - locking the phone / backgrounding the tab (the server keeps computing; we
 *     re-poll on `visibilitychange` and resume from the persisted job_id);
 *   - a full refresh / app restart (active job_ids are persisted to localStorage
 *     and resumed on load).
 *
 * On completion the manager itself merges the result into the freshest local
 * case and saves it to IndexedDB, so the result is never lost even if no screen
 * is mounted. Components subscribe via `subscribeAnalysis` / `useAnalysisState`.
 */
import { useSyncExternalStore } from 'react';
import { API } from '../config';
import { dbGet, dbSave } from '../db';
import { mergeWithAi } from '../domain/caseMerge';
import type { CaseAnalysis } from '../domain/types';

export type AnalysisStatus = 'running' | 'done' | 'error';
export interface AnalysisState { status: AnalysisStatus; startedAt: number; error?: string }

interface JobRecord {
  jobId: string;
  ownerId: string;
  caseId: string;
  analyzedDocIds: string[];
  mode: 'flash' | 'pro';
  startedAt: number;
}

const LS_KEY = 'plt:analysis-jobs';
const POLL_MS = 2000;

const states = new Map<string, AnalysisState>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();
let tick = 0; // bumped on every change so useSyncExternalStore re-reads

function emit() {
  tick++;
  listeners.forEach(l => { try { l(); } catch { /* ignore */ } });
}

function setState(caseId: string, s: AnalysisState) { states.set(caseId, s); emit(); }
function clearState(caseId: string) { states.delete(caseId); emit(); }

function clearTimer(caseId: string) {
  const t = timers.get(caseId);
  if (t) { clearTimeout(t); timers.delete(caseId); }
}

// ── persisted active jobs (localStorage; small, survives refresh) ────────────
function loadJobs(): Record<string, JobRecord> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}
function saveJobs(jobs: Record<string, JobRecord>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(jobs)); } catch { /* ignore */ }
}
function putJob(rec: JobRecord) { const j = loadJobs(); j[rec.caseId] = rec; saveJobs(j); }
function removeJob(caseId: string) { const j = loadJobs(); delete j[caseId]; saveJobs(j); }

async function finalize(rec: JobRecord, result: CaseAnalysis) {
  // Merge into the freshest local copy (the lawyer may have edited it meanwhile)
  // and preserve the raw documents, marking the analyzed ones. Pro replaces the
  // AI-owned fields; flash merges incrementally (mergeWithAi default).
  const current = await dbGet<CaseAnalysis>(rec.ownerId, rec.caseId);
  if (!current) return;
  const merged = mergeWithAi(current, result, { replaceAiFields: rec.mode === 'pro' });
  const analyzed = Array.from(new Set([...(current.analyzed_doc_ids ?? []), ...rec.analyzedDocIds]));
  const updated = { ...merged, raw_documents: current.raw_documents ?? [], analyzed_doc_ids: analyzed };
  await dbSave(rec.ownerId, updated);
}

async function pollOnce(rec: JobRecord) {
  clearTimer(rec.caseId);
  try {
    const r = await fetch(`${API}/api/analyze-jobs/${rec.jobId}`);
    if (r.status === 404) { // lost to a server cold start
      removeJob(rec.caseId);
      setState(rec.caseId, { status: 'error', startedAt: rec.startedAt, error: 'Analisi interrotta sul server. Riprova.' });
      return;
    }
    if (!r.ok) throw new Error(`${r.status}`);
    const body = await r.json() as { status: AnalysisStatus; result: CaseAnalysis | null; error: string | null };
    if (body.status === 'running') { schedule(rec); return; }
    if (body.status === 'done' && body.result) {
      await finalize(rec, body.result);
      removeJob(rec.caseId);
      setState(rec.caseId, { status: 'done', startedAt: rec.startedAt });
      return;
    }
    removeJob(rec.caseId);
    setState(rec.caseId, { status: 'error', startedAt: rec.startedAt, error: body.error ?? 'Errore durante l\'analisi.' });
  } catch {
    schedule(rec); // transient network/throttle — keep trying
  }
}

function schedule(rec: JobRecord) {
  clearTimer(rec.caseId);
  timers.set(rec.caseId, setTimeout(() => { void pollOnce(rec); }, POLL_MS));
}

export interface StartAnalysisOptions {
  caseId: string;
  ownerId: string;
  analyzedDocIds: string[];
  mode: 'flash' | 'pro';
  body: unknown; // AnalyzeRequest payload
}

export async function startAnalysis(opts: StartAnalysisOptions): Promise<void> {
  const startedAt = Date.now();
  setState(opts.caseId, { status: 'running', startedAt });
  try {
    const r = await fetch(`${API}/api/analyze-jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts.body),
    });
    if (!r.ok) throw new Error(`${r.status}`);
    const { job_id } = await r.json() as { job_id: string };
    const rec: JobRecord = { jobId: job_id, ownerId: opts.ownerId, caseId: opts.caseId, analyzedDocIds: opts.analyzedDocIds, mode: opts.mode, startedAt };
    putJob(rec);
    void pollOnce(rec);
  } catch (e) {
    setState(opts.caseId, { status: 'error', startedAt, error: (e as Error).message });
  }
}

/** Clear a terminal (done/error) state once a screen has shown it. */
export function dismissAnalysis(caseId: string) { clearTimer(caseId); clearState(caseId); }

/** User pressed "Rinuncia": stop polling locally; the server job expires on its own. */
export function abortAnalysis(caseId: string) { clearTimer(caseId); removeJob(caseId); clearState(caseId); }

export function getAnalysisState(caseId: string): AnalysisState | undefined { return states.get(caseId); }

export function runningAnalysisCount(): number {
  let n = 0;
  for (const s of states.values()) if (s.status === 'running') n++;
  return n;
}

/** Resume polling for any job persisted before a refresh/restart. Call once at app start. */
export function resumePersistedAnalyses() {
  for (const rec of Object.values(loadJobs())) {
    if (!states.has(rec.caseId)) {
      states.set(rec.caseId, { status: 'running', startedAt: rec.startedAt });
      void pollOnce(rec);
    }
  }
  emit();
}

export function subscribeAnalysis(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// Re-poke polling when the tab becomes visible again (after phone unlock / tab
// switch) — timers may have been frozen/throttled while hidden.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      for (const rec of Object.values(loadJobs())) void pollOnce(rec);
    }
  });
}

/** Subscribe to a single case's analysis state. */
export function useAnalysisState(caseId: string): AnalysisState | undefined {
  return useSyncExternalStore(subscribeAnalysis, () => states.get(caseId));
}

/** Subscribe to the global change counter (for the case list indicators). */
export function useAnalysisTick(): number {
  return useSyncExternalStore(subscribeAnalysis, () => tick);
}
