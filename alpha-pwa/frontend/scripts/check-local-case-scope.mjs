import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  localCaseKey,
  localOwnerIdFromSession,
  LEGACY_LOCAL_OWNER_ID,
} from '../src/db.ts';

assert.equal(localOwnerIdFromSession({ user: { id: 'user-a' } }), 'user-a');
assert.equal(localOwnerIdFromSession(null), 'anonymous');
assert.equal(localCaseKey('user-a', 'case-1'), 'user-a::case-1');
assert.notEqual(localCaseKey('user-a', 'same-case'), localCaseKey('user-b', 'same-case'));
assert.equal(LEGACY_LOCAL_OWNER_ID, 'legacy');

const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const db = readFileSync(new URL('../src/db.ts', import.meta.url), 'utf8');

for (const snippet of [
  'localOwnerIdFromSession(session)',
  'await dbList(localOwnerId)',
  'await dbSave(localOwnerId, newCase)',
  'await dbDelete(localOwnerId, id)',
  'await dbGet(localOwnerId, data.case_id)',
  'await dbSave(localOwnerId, data as CaseAnalysis)',
  'session={session}',
  'local_owner_id',
  'local_id',
]) {
  assert.ok(main.includes(snippet) || db.includes(snippet), `missing account-scope snippet: ${snippet}`);
}

assert.ok(!/await dbList\(\)/.test(main), 'dbList must always receive the current local owner id');
assert.ok(!/await dbGet\(caseId\)/.test(main), 'case detail dbGet must receive the current local owner id');
assert.ok(!/await dbSave\(updated\)/.test(main), 'case saves must include the current local owner id');
assert.ok(!/await dbDelete\(id\)/.test(main), 'case deletes must include the current local owner id');

console.log('local case account-scope checks passed');
