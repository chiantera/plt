import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');

assert.match(main, /type TabId = 'timeline' \| 'deadlines' \| 'facts' \| 'legal' \| 'drafts'/);
assert.match(main, /function DraftingWorkspace/);
assert.match(main, /onOpenDraft=\{handleOpenDraftWorkspace\}/);
assert.match(main, /onClick=\{\(\) => onOpenDraft\(key, label\)\}/);
assert.equal(/onClick=\{\(\) => onOpenChat\(key\)\}/.test(main), false, 'drafting cards must not open chat by key');
assert.equal(/Prepara controesame con GiulIA[\s\S]{0,260}onOpenChat/.test(main), false, 'witness controesame button must not open chat');
assert.equal(/Prepara con GiulIA[\s\S]{0,260}onOpenChat/.test(main), false, 'deadline preparation button must not open chat');
assert.match(main, /const finalizedCase = updateDraftArtifact\(createdCase, finalized\)/);
assert.match(main, /const failedCase = updateDraftArtifact\(createdCase, failed\)/);
assert.equal(/updateCase\(c => updateDraftArtifact\(c, finalized\)\)/.test(main), false, 'draft generation must not overwrite the newly-created workspace via stale caseData closure');
assert.match(main, /DRAFT_PLAINTEXT_EXPORT_WARNING/);
assert.match(main, /Proteggi tutto come \.plt/);
assert.match(main, /flagUnverifiedCassationCitations/);
assert.match(main, /addDraftArtifact\(caseData, placeholder\)/);

console.log('draft workspace UI checks passed');
