import assert from 'node:assert/strict';
import { mergeWithAi } from '../src/domain/caseMerge.ts';

const usage = (proUsed, route) => ({
  pages: 1,
  audio_minutes: 0,
  flash_input_tokens: 10,
  flash_output_tokens: 20,
  pro_used: proUsed,
  model_route: route,
});

const rec = recommended => ({
  recommended,
  reasons: recommended ? ['contradictions'] : [],
  message: recommended ? 'Approfondimento consigliato' : '',
  cta_label: 'Avvia Analisi Pro',
  alternate_label: 'Continua con analisi standard',
  requires_confirmation: true,
  auto_charge: false,
});

const legal = (riskLevel, summary, action) => ({
  risk_level: riskLevel,
  risk_summary: summary,
  immediate_actions: [action],
  charges: [],
  strategies: [],
  constitutional_issues: [],
  witness_assessments: [],
  evidence_balance: {
    prosecution_strength: 0.5,
    defense_strength: 0.5,
    key_prosecution_evidence: [],
    key_defense_evidence: [],
    critical_gaps: [],
    overall_assessment: summary,
  },
  client_summary: summary,
});

const baseCase = overrides => ({
  case_id: 'local-case',
  case_title: 'Titolo scelto dal Collega',
  language: 'it',
  case_summary: 'Sintesi Flash',
  materials: [{ id: 'old-material', name: 'Verbale', kind: 'text', description: '', excerpt: '', content: '' }],
  timeline: [{ date: null, time: null, title: 'Evento Flash', description: '', source_refs: [], confidence: 0.8 }],
  people: [],
  evidence: [],
  open_questions: [],
  missing_documents: [],
  contradictions: [],
  procedural_deadlines: [],
  brief_markdown: 'Brief Flash',
  usage_estimate: usage(false, 'deepseek-v4-flash'),
  pro_recommendation: rec(true),
  legal_analysis: legal('medium', 'Rischio Flash', 'Azione Flash'),
  raw_documents: [{ doc_id: 'doc-1', name: 'doc', description: 'doc', text: 'testo', added_at: '2026-05-27T00:00:00Z', category: 'fascicolo' }],
  analyzed_doc_ids: ['doc-1'],
  redaction_rules: [{ id: 'r1', original: 'Mario', replacement: '[CLIENTE]', enabled: true }],
  draft_artifacts: [{ id: 'd1', title: 'Bozza' }],
  ...overrides,
});

const proAi = baseCase({
  case_id: 'ai-case',
  case_title: 'Titolo AI da non usare',
  case_summary: 'Sintesi Pro molto piu approfondita',
  materials: [{ id: 'pro-material', name: 'Verbale Pro', kind: 'text', description: '', excerpt: '', content: '' }],
  timeline: [{ date: null, time: null, title: 'Evento Pro', description: '', source_refs: [], confidence: 0.9 }],
  brief_markdown: 'Brief Pro',
  usage_estimate: usage(true, 'deepseek-v4-pro'),
  pro_recommendation: rec(false),
  legal_analysis: legal('critical', 'Rischio Pro', 'Azione Pro'),
  raw_documents: [],
  analyzed_doc_ids: [],
  redaction_rules: [],
  draft_artifacts: [],
});

const existing = baseCase({});
const proMerged = mergeWithAi(existing, proAi, { replaceAiFields: true });

assert.equal(proMerged.case_id, existing.case_id, 'Pro merge must keep local case id');
assert.equal(proMerged.case_title, existing.case_title, 'Pro merge must keep lawyer-selected title');
assert.equal(proMerged.case_summary, proAi.case_summary, 'Pro merge must replace Flash summary');
assert.equal(proMerged.brief_markdown, proAi.brief_markdown, 'Pro merge must replace Flash brief');
assert.deepEqual(proMerged.timeline, proAi.timeline, 'Pro merge must replace AI-derived timeline');
assert.equal(proMerged.usage_estimate.pro_used, true, 'Pro merge must expose Pro usage');
assert.equal(proMerged.usage_estimate.model_route, 'deepseek-v4-pro', 'Pro merge must expose Pro route');
assert.equal(proMerged.pro_recommendation.recommended, false, 'Pro recommendation must disappear after Pro response');
assert.equal(proMerged.legal_analysis.risk_level, 'critical', 'Pro merge must replace preserved Flash legal risk');
assert.deepEqual(proMerged.legal_analysis.immediate_actions, ['Azione Pro'], 'Pro merge must replace Flash actions');
assert.deepEqual(proMerged.raw_documents, existing.raw_documents, 'Pro merge must preserve local raw docs');
assert.deepEqual(proMerged.analyzed_doc_ids, existing.analyzed_doc_ids, 'Pro merge must preserve analyzed doc ids');
assert.deepEqual(proMerged.redaction_rules, existing.redaction_rules, 'Pro merge must preserve redaction rules');
assert.deepEqual(proMerged.draft_artifacts, existing.draft_artifacts, 'Pro merge must preserve draft artifacts');

const flashMerged = mergeWithAi(existing, proAi);
assert.equal(flashMerged.case_summary, existing.case_summary, 'Default merge should preserve existing summary');
assert.equal(flashMerged.legal_analysis.risk_level, existing.legal_analysis.risk_level, 'Default merge should preserve existing legal risk');
assert.deepEqual(flashMerged.redaction_rules, existing.redaction_rules, 'Default merge must preserve redaction rules');
assert.deepEqual(flashMerged.draft_artifacts, existing.draft_artifacts, 'Default merge must preserve draft artifacts');

console.log('case merge checks passed');
