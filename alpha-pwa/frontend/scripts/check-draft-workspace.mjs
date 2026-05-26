import assert from 'node:assert/strict';
import {
  DRAFT_PLAINTEXT_EXPORT_WARNING,
  addDraftArtifact,
  buildDraftPrompt,
  createDraftArtifact,
  exportDraftArtifact,
  flagUnverifiedCassationCitations,
} from '../src/draftArtifacts.ts';

const baseCase = {
  case_id: 'case-draft-1',
  case_title: 'Furto aggravato - Mario Rossi',
  case_summary: 'Mario Rossi contesta la ricostruzione dei fatti.',
  materials: [],
  timeline: [],
  people: [{ name: 'Mario Rossi', role: 'imputato', notes: 'assistito' }],
  evidence: [],
  open_questions: [],
  missing_documents: [],
  contradictions: [],
  procedural_deadlines: [],
  brief_markdown: 'Promemoria con nome Mario Rossi',
  usage_estimate: { pages: 1, audio_minutes: 0, flash_input_tokens: 100, flash_output_tokens: 50, pro_used: false },
  legal_analysis: null,
};

const prompt = buildDraftPrompt({
  caseData: baseCase,
  type: 'cassazione',
  promptTail: ctx => `${ctx}\n\n---\nPredisponi un ricorso per Cassazione con motivi ex art. 606 c.p.p. e Precedenti della Cassazione favorevoli (cita sezione e numero).`,
  buildCaseContext: c => `FASCICOLO: ${c.case_title}\nSINTESI: ${c.case_summary}`,
  anonymized: false,
  workspaceTitle: 'Ricorso Cassazione',
});

assert.match(prompt, /Predisponi un ricorso per Cassazione/);
assert.match(prompt, /DIVIETO ASSOLUTO: non inventare precedenti giurisprudenziali\./);
assert.match(prompt, /DA VERIFICARE/);
assert.match(prompt, /FASCICOLO: Furto aggravato - Mario Rossi/);
assert.match(prompt, /TITOLO WORKSPACE \/ PROSSIMA PRIORITÀ: "Ricorso Cassazione"/);
assert.match(prompt, /# Ricorso Cassazione/);
assert.doesNotMatch(prompt, /Non sostituirlo con un'etichetta interna come "Analisi strategica" se il titolo utente è più specifico[\s\S]*TIPO BOZZA: Analisi strategica/);

const nextPriorityPrompt = buildDraftPrompt({
  caseData: baseCase,
  type: 'strategy',
  promptTail: ctx => `${ctx}\n\n---\nAnalisi strategica approfondita del caso.`,
  buildCaseContext: c => `FASCICOLO: ${c.case_title}`,
  workspaceTitle: 'Deposito lista testi',
  extraInstruction: 'Prepara una bozza operativa sulla prossima priorità "Deposito lista testi".',
});
assert.match(nextPriorityPrompt, /TITOLO WORKSPACE \/ PROSSIMA PRIORITÀ: "Deposito lista testi"/);
assert.match(nextPriorityPrompt, /# Deposito lista testi/);
assert.match(nextPriorityPrompt, /Non sono pienamente certa di cosa significhi la prossima priorità 'Deposito lista testi'/);
assert.match(nextPriorityPrompt, /Non sostituirlo con un'etichetta interna come "Analisi strategica"/);

const first = createDraftArtifact({
  caseData: baseCase,
  type: 'memoria',
  title: 'Memoria difensiva',
  prompt,
  contentMarkdown: 'Cass. pen., sez. VI, n. 12345/2020 afferma un principio favorevole.',
});
const second = createDraftArtifact({
  caseData: baseCase,
  type: 'memoria',
  title: 'Memoria difensiva',
  prompt,
  contentMarkdown: 'Seconda versione alternativa.',
});

assert.notEqual(first.id, second.id, 'each purple-button click must create a new draft id');
assert.equal(first.case_id, baseCase.case_id);
assert.equal(first.status, 'draft');
assert.equal(first.generation_notes.precedent_policy, 'no_invented_precedents');

const updated = addDraftArtifact(baseCase, first);
const updatedAgain = addDraftArtifact(updated, second);
assert.equal(updatedAgain.draft_artifacts.length, 2, 'draft workspaces must append, not overwrite');
assert.equal(updatedAgain.draft_artifacts[0].id, first.id);
assert.equal(updatedAgain.draft_artifacts[1].id, second.id);

const flagged = flagUnverifiedCassationCitations(first);
assert.equal(flagged.claim_refs.length, 1);
assert.equal(flagged.claim_refs[0].status, 'da_verificare');
assert.match(flagged.content_markdown, /DA VERIFICARE/);

assert.match(DRAFT_PLAINTEXT_EXPORT_WARNING, /non è cifrato/i);
assert.match(DRAFT_PLAINTEXT_EXPORT_WARNING, /intero fascicolo.*\.plt protetto/i);

const md = exportDraftArtifact(flagged, 'md');
assert.equal(md.filename.endsWith('.md'), true);
assert.match(md.content, /DA VERIFICARE/);

const txt = exportDraftArtifact(flagged, 'txt');
assert.equal(txt.filename.endsWith('.txt'), true);
assert.equal(txt.content.includes('**'), false);

const html = exportDraftArtifact(flagged, 'html');
assert.equal(html.filename.endsWith('.html'), true);
assert.match(html.content, /<!doctype html>/i);

console.log('draft workspace checks passed');
