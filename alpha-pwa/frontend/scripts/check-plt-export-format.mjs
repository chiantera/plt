import assert from 'node:assert/strict';
import {
  decryptPltContainer,
  exportEncryptedPlt,
  exportPlainPlt,
  parsePltFile,
  PLT_FORMAT,
  PLT_VERSION,
} from '../src/pltExport.ts';

const caseData = {
  case_id: 'case-test-1',
  case_title: 'Furto aggravato - Mario Rossi',
  client_name: 'Mario Rossi',
  case_summary: 'Mario Rossi è accusato di furto aggravato in Roma.',
  materials: [],
  timeline: [],
  people: [],
  evidence: [],
  open_questions: [],
  missing_documents: [],
  contradictions: [],
  procedural_deadlines: [],
  brief_markdown: 'Promemoria per Mario Rossi',
  usage_estimate: { pages: 1, audio_minutes: 0, flash_input_tokens: 100, flash_output_tokens: 50, pro_used: false },
  legal_analysis: null,
};

const password = 'frase lunga per fascicolo protetto 2026';

const plain = exportPlainPlt(caseData);
assert.equal(plain.format, PLT_FORMAT);
assert.equal(plain.version, PLT_VERSION);
assert.equal(plain.encrypted, false);
assert.equal(plain.payload.case_title, caseData.case_title);

const parsedPlain = await parsePltFile(JSON.stringify(plain));
assert.equal(parsedPlain.kind, 'case');
assert.equal(parsedPlain.caseData.case_title, caseData.case_title);
assert.equal(parsedPlain.protected, false);

const parsedLegacy = await parsePltFile(JSON.stringify(caseData));
assert.equal(parsedLegacy.kind, 'case');
assert.equal(parsedLegacy.caseData.case_id, caseData.case_id);
assert.equal(parsedLegacy.legacy, true);

const encrypted = await exportEncryptedPlt(caseData, password);
assert.equal(encrypted.format, PLT_FORMAT);
assert.equal(encrypted.version, PLT_VERSION);
assert.equal(encrypted.encrypted, true);
assert.equal(encrypted.kdf.name, 'PBKDF2');
assert.equal(encrypted.kdf.hash, 'SHA-256');
assert.ok(encrypted.kdf.iterations >= 600000);
assert.equal(encrypted.cipher.name, 'AES-GCM');
assert.equal(typeof encrypted.payload, 'string');

const encryptedText = JSON.stringify(encrypted);
assert.equal(encryptedText.includes('Mario Rossi'), false, 'encrypted .plt must not expose client name in plaintext');
assert.equal(encryptedText.includes('Furto aggravato'), false, 'encrypted .plt must not expose case title in plaintext');
assert.equal(encryptedText.includes('Promemoria'), false, 'encrypted .plt must not expose brief text in plaintext');

const parsedEncrypted = await parsePltFile(encryptedText);
assert.equal(parsedEncrypted.kind, 'encrypted');
assert.equal(parsedEncrypted.container.encrypted, true);

const decrypted = await decryptPltContainer(parsedEncrypted.container, password);
assert.equal(decrypted.case_title, caseData.case_title);
assert.equal(decrypted.client_name, caseData.client_name);

await assert.rejects(
  () => decryptPltContainer(parsedEncrypted.container, 'password sbagliata'),
  /Password errata o file danneggiato\./,
);

await assert.rejects(
  () => parsePltFile('{"format":"pocket-legal-triage.case","version":999,"encrypted":false,"payload":{}}'),
  /versione non supportata/i,
);

console.log('plt export/import format checks passed');
