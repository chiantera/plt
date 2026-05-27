import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// After bundle splitting, DraftingWorkspace and related logic live in CaseDetailView.tsx
const cdv = readFileSync(new URL('../src/screens/CaseDetailView.tsx', import.meta.url), 'utf8');
const domainTypes = readFileSync(new URL('../src/domain/types.ts', import.meta.url), 'utf8');

assert.match(domainTypes, /export type TabId = 'timeline' \| 'deadlines' \| 'facts' \| 'legal' \| 'drafts'/);
assert.match(cdv, /function DraftingWorkspace/);
assert.match(cdv, /onOpenDraft=\{handleOpenDraftWorkspace\}/);
assert.match(cdv, /onClick=\{\(\) => onOpenDraft\(key, label\)\}/);
assert.equal(/onClick=\{\(\) => onOpenChat\(key\)\}/.test(cdv), false, 'drafting cards must not open chat by key');
assert.equal(/Prepara controesame con GiulIA[\s\S]{0,260}onOpenChat/.test(cdv), false, 'witness controesame button must not open chat');
assert.equal(/Prepara con GiulIA[\s\S]{0,260}onOpenChat/.test(cdv), false, 'deadline preparation button must not open chat');
assert.match(cdv, /const finalizedCase = updateDraftArtifact\(createdCase, finalized\)/);
assert.match(cdv, /const failedCase = updateDraftArtifact\(createdCase, failed\)/);
assert.equal(/updateCase\(c => updateDraftArtifact\(c, finalized\)\)/.test(cdv), false, 'draft generation must not overwrite the newly-created workspace via stale caseData closure');
assert.match(cdv, /DRAFT_PLAINTEXT_EXPORT_WARNING/);
assert.match(cdv, /Proteggi tutto come \.plt/);
assert.match(cdv, /flagUnverifiedCassationCitations/);
assert.match(cdv, /addDraftArtifact\(caseData, placeholder\)/);

console.log('draft workspace UI checks passed');
