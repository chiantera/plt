# Drafting Workspace v1 — Design Spec

_Date: 2026-05-26_

## Summary

Replace PLT's current “draft legal act by opening GiulIA chat with a long prompt” behavior with a dedicated drafting workflow. The first implementation slice is hybrid: drafts are real case artifacts persisted locally in IndexedDB, generated through the existing chat backend boundary for now, and exportable/redactable using existing PLT privacy/export logic.

This is not an “AI lawyer” feature. It is a lawyer-controlled drafting workspace for preparing, reviewing, editing, verifying, anonymizing, and exporting legal work product.

## Problem

Current purple GiulIA buttons and the `Redazione atti con AI` cards call `onOpenChat(...)`, inject case context into a long prompt, and stream the answer into the floating chat. This is weak product design:

- generated acts become chat messages instead of durable case artifacts;
- there is no structured review workflow;
- privacy/redaction/export decisions are detached from generation;
- source use and assumptions are not visible enough;
- fake or unverifiable precedent citations are not explicitly prevented;
- the user cannot manage versions, statuses, or exports per document.

## Goals

1. Drafting buttons open a dedicated Drafting Workspace, not GiulIA chat.
2. Generated documents are saved locally as structured `DraftArtifact` objects tied to the current fascicolo.
3. The lawyer can generate using original or anonymized case context.
4. The lawyer can export a draft as `.plt`, `.md`, `.txt`, `.html`, or `.docx`.
5. `.plt` export can be encrypted or plaintext using existing PLT Web Crypto logic.
6. Plain/unprotected export must make anonymization explicit and warn before exposing original sensitive data.
7. Drafting prompts must include a hard rule: never invent precedents or Cassazione citations.
8. The UI must surface verification warnings before deposit/use.

## Non-goals for v1

- No server-side draft database.
- No collaborative editing.
- No real Office password encryption for `.docx`.
- No full legal research database integration.
- No automatic filing/deposit workflow.
- No claim that AI-generated precedents are verified.

## Existing Code To Reuse

Relevant existing frontend pieces:

- `applyRedactionToCase(caseData, rules)`
- `redactString(...)`
- `redactObj(...)`
- `mergeRedactionRules(...)`
- `useRedactionRules()`
- `RedactionDrawer`
- `exportEncryptedPlt(...)`
- `exportPlainPlt(...)`
- `parsePltFile(...)`
- `decryptPltContainer(...)`
- `buildCaseContext(...)`
- existing `/api/chat` streaming endpoint

Current drafting entry points to replace:

- witness `Prepara controesame con GiulIA` button in `LegalAnalysisSection`
- `Redazione atti con AI` cards: memoria, cassazione, eccezione, controesame, strategia
- any other contextual `Prepara con GiulIA` buttons that currently call `onOpenChat(...)`

## Data Model

Add local draft artifacts to the case model:

```ts
type DraftType =
  | 'memoria_difensiva'
  | 'ricorso_cassazione'
  | 'eccezione_procedurale'
  | 'controesame'
  | 'analisi_strategica';

type DraftStatus = 'draft' | 'reviewing' | 'approved' | 'archived';

type DraftArtifact = {
  id: string;
  case_id: string;
  type: DraftType;
  title: string;
  status: DraftStatus;
  content_markdown: string;
  source_refs: SourceRef[];
  claim_refs: DraftClaimRef[];
  generated_at: string;
  updated_at: string;
  generation_notes: {
    model_mode: 'flash' | 'pro';
    used_redacted_context: boolean;
    warnings: string[];
    missing_information: string[];
    precedent_policy: 'no_invented_precedents';
  };
  export_options?: {
    last_exported_at?: string;
    last_export_format?: 'plt' | 'md' | 'txt' | 'html' | 'docx';
    last_export_was_encrypted?: boolean;
    last_export_was_anonymized?: boolean;
  };
};

type DraftClaimRef = {
  id: string;
  claim_text: string;
  source_refs: SourceRef[];
  source_quote?: string;
  confidence: number;
  status: 'sourced' | 'da_verificare' | 'unsupported';
};
```

Extend `CaseAnalysis`:

```ts
type CaseAnalysis = {
  // existing fields...
  draft_artifacts?: DraftArtifact[];
};
```

Persistence: use the existing local case persistence path (`dbSave`, `dbGet`) by saving the updated `CaseAnalysis` with `draft_artifacts` included.

Storage guardrail for v1: cap an individual draft artifact at roughly 500 KB of Markdown/metadata and keep at most 20 active drafts per case before prompting the user to archive/delete older drafts. This avoids uncontrolled case-record growth while keeping implementation local-first. If drafts become large or numerous, move them to a separate IndexedDB object store keyed by `case_id` in a follow-up slice.

## UI Design

### Entry behavior

Drafting buttons should call a new handler, conceptually:

```ts
onOpenDraftWorkspace({ type, witnessId?, initialScope? })
```

They must not call `onOpenChat(...)`.

### Workspace layout

On mobile: full-screen bottom sheet / drawer.
On desktop: large modal or side drawer.

Sections:

1. **Setup**
   - document type
   - title
   - objective
   - privacy mode: original or anonymized context
   - model mode: flash/pro, with pro recommended for complex legal reasoning

2. **Fonti usate**
   - selected timeline events
   - selected evidence
   - contradictions
   - procedural deadlines
   - legal analysis blocks
   - witness-specific facts for controesame

3. **Bozza**
   - editable Markdown text area/editor
   - save status
   - regenerate/revise controls

4. **Verifiche**
   - missing information
   - assumptions
   - source coverage
   - unsupported assertions
   - claim/source table: claim, source quote, confidence, status
   - precedent verification warnings
   - checklist before use/deposit

5. **Export**
   - format selector
   - original vs anonymized copy
   - protected `.plt` vs plaintext `.plt`
   - password fields for protected `.plt`
   - download button

### Copy requirements

Use Italian UI copy. Keep terminology precise:

- privacy redaction: `Anonimizza`, `anonimizzazione`, `copia anonimizzata`
- legal drafting: `Redigi`, `Redazione atti`
- no false-friend `Redigi` for privacy masking

Required warning copy near generation/export:

> GiulIA non deve inventare precedenti. Le citazioni giurisprudenziali vanno verificate in banca dati prima del deposito.

Required lawyer-in-control copy:

> Bozza di lavoro per l’avvocato. Non depositare senza verifica manuale di fatti, fonti, norme, termini e giurisprudenza.

Copy review rule: do not imply autonomous legal judgment. GiulIA may help prepare and organize drafts; the lawyer decides, verifies, edits, and approves.

Required verification checklist item:

> Verifica manualmente norme, rito, termini, competenza e ogni precedente citato.

## Generation Flow

1. User opens workspace from a drafting button.
2. Workspace builds a source scope from current case state.
3. If `Usa contesto anonimizzato` is selected:
   - merge global + per-case redaction rules;
   - apply `applyRedactionToCase(caseData, rules)`;
   - build generation context from the redacted case.
4. If no redaction rules exist, show `Apri Anonimizza` and disable or warn on anonymized generation.
5. Call a new frontend helper, conceptually:

```ts
async function generateDraftArtifact(input: DraftGenerationInput): Promise<DraftArtifact>
```

6. For v1, the helper may call existing `/api/chat` with a drafting-specific system/user prompt and collect the full streamed response.
7. Save returned artifact into `caseData.draft_artifacts` and persist locally.
8. Show generated draft in the editor.

## Prompt Policy: Never Invent Precedents

Every drafting prompt must include this rule verbatim or substantially equivalent:

```text
DIVIETO ASSOLUTO: non inventare precedenti giurisprudenziali.
Cita una sentenza solo se sei ragionevolmente certa dell’esistenza e dei dati minimi:
Corte, sezione, numero, anno/data, principio rilevante.
Se non sei certa, NON citare numero o anno. Scrivi invece:
"Orientamento da verificare in banca dati prima del deposito"
oppure
"Giurisprudenza da ricercare/verificare".
Non creare mai citazioni verosimili ma non verificate.
```

Expected output behavior:

- Known/usable citations may be included only with enough identifying data.
- Known/usable citations may be treated as usable only if they have a source reference or are otherwise explicitly marked for manual database verification.
- Any precedent without a source reference must be labeled `DA VERIFICARE`.
- The draft must include a `Controlli prima del deposito` or equivalent section.
- Never fabricate Cassazione section/number/year combinations.

Post-generation validation should scan for Cassazione-like citations (`Cass.`, `Cassazione`, `Sez.`, `n.`, year/date patterns). If a citation has no source link or verified reference metadata, flag it in the `Verifiche` panel as `DA VERIFICARE` before export/use. The UI must not present unsourced precedents as verified.

## Source-Link Policy

Substantive factual assertions in generated drafts should be source-linked where possible. For each important claim, the workspace should expose:

- claim text;
- source reference(s);
- source quote or excerpt when available;
- confidence score;
- status: `sourced`, `da_verificare`, or `unsupported`.

Unsupported assertions are allowed only as visibly marked draft material. Before export, the `Verifiche` section must list unsupported or `DA VERIFICARE` claims. Export is still allowed because the lawyer controls the workflow, but the warning must be visible and included in `.plt` metadata.

## Export Design

### Formats

- `.plt`: structured PLT draft artifact/container. Can be encrypted or plaintext.
- `.md`: Markdown only.
- `.txt`: plain text.
- `.html`: self-contained readable HTML.
- `.docx`: Word document.

Note: existing app convention is `.plt`, not `.ptl`. If `.ptl` is required later, add alias support deliberately; do not silently fork the format.

### Encryption

Use existing Web Crypto `.plt` encryption for protected exports:

- PBKDF2-HMAC-SHA256
- AES-256-GCM
- fresh salt/IV per export
- portable password-based container

For `.md`, `.txt`, `.html`, and `.docx`, v1 exports are readable plaintext files. If the user asks for encryption with those formats, wrap the document in a protected `.plt` container instead of pretending those formats are encrypted.

### Export payload

For draft `.plt` export, use a draft-specific container payload such as:

```ts
type DraftExportPayload = {
  export_kind: 'draft_artifact';
  case_id: string;
  case_title: string;
  draft: DraftArtifact;
};
```

If current `parsePltFile` only accepts full case payloads, v1 can either:

- export draft artifacts as standalone JSON containers not yet importable; or
- extend parser support for `export_kind: 'draft_artifact'` in a focused test-backed slice.

Recommendation: support draft artifact containers in parser/import only if implementation time allows; otherwise label exported `.plt` as draft backup/export, not full import path.

V1 decision: draft `.plt` export is **backup/export-only** unless import support is explicitly implemented in the same slice. UI and filenames must say `bozza-...-backup.plt` or equivalent. Do not imply that standalone draft `.plt` files can be imported as full fascicoli. Add draft-import support as a follow-up if not completed.

### Anonymized export

For export, apply rules to the draft artifact itself, not only to the displayed case.

Redaction scope for draft export includes:

- draft title;
- Markdown body;
- claim text;
- source quotes/excerpts;
- source reference labels and filenames when they contain sensitive identifiers;
- generation notes and warning strings;
- HTML metadata/title;
- DOCX core title/subject fields if generated by a library.

- if rules exist and export is plaintext, default to `Copia anonimizzata`;
- if no rules exist, offer `Apri Anonimizza`;
- if original + plaintext is selected, require explicit confirmation;
- encrypted `.plt` may default to original but still offers anonymized copy.

Acceptance criterion: anonymized exports must not contain known sensitive strings covered by active rules in body, title, metadata, filenames embedded in the payload, or source excerpts.

### Password UX

Protected `.plt` export requires:

- password field;
- confirm-password field;
- mismatch error before export;
- missing-password error before export;
- current export selections preserved after failure;
- reminder that PLT cannot recover the password and it should be sent via a separate channel.

### DOCX v1 strategy

Preferred implementation: generate a real `.docx` using a maintained browser-compatible library. If adding the dependency is not acceptable in the implementation slice, ship `.docx` only when the generated file opens in LibreOffice/Word during QA; otherwise hide/disable the option and leave it as a follow-up. Do not download fake `.docx` files that are actually HTML with a renamed extension.

## Draft Status Rules

Status transitions:

- new generated artifact starts as `draft`;
- manual edit or AI revision keeps/sets `reviewing` after the first save;
- `approved` only after explicit lawyer action, e.g. `Segna come verificata`;
- `archived` only by explicit user action;
- any regeneration from an approved artifact creates a new `draft` version rather than mutating the approved one silently.

The UI must show status and persist it across reloads. “Approved” means only “marked verified by the user inside PLT”; it must not imply court-ready correctness.

## Error Handling

- Generation failure: keep workspace open, show error, preserve any existing draft text.
- Empty AI output: show `La generazione non ha prodotto testo utilizzabile.`
- Missing case data: disable generation and show `Fascicolo non ancora caricato.`
- No anonymization rules: disable anonymized mode or show warning with `Apri Anonimizza`.
- Export encryption password missing: reuse existing `Inserisci una password per proteggere...` error.
- Unsupported export format: show a toast and do not download a malformed file.

## Testing / Verification

Minimum checks:

1. Clicking each `Redazione atti con AI` card opens Drafting Workspace, not chat.
2. Witness `Prepara controesame con GiulIA` opens the workspace with witness scope.
3. Generated draft is saved in `caseData.draft_artifacts`.
4. Draft persists after reload.
5. Anonymized generation uses `applyRedactionToCase` on the source context.
6. Anonymized export applies rules to the draft artifact content.
7. Plain original export shows a warning/confirmation.
8. Encrypted `.plt` draft export does not contain known sensitive strings in plaintext.
9. `.md`, `.txt`, `.html` downloads contain the expected draft content.
10. `.docx` download opens as a Word-readable document.
11. Drafting prompt contains `DIVIETO ASSOLUTO: non inventare precedenti giurisprudenziali` or equivalent.
12. UI displays the precedent verification warning.
13. Every substantive generated claim is either source-linked or marked `DA VERIFICARE` / `unsupported` in the review panel.
14. Unsourced Cassazione-like citations are flagged `DA VERIFICARE` and not presented as verified.
15. Anonymized export contains no sensitive identifiers covered by active rules in title/body/source excerpts/metadata.
16. Draft status transitions persist and “approved” requires explicit user action.
17. Protected export validates password confirmation and preserves state on failure.
18. Frontend production build passes.
19. Browser QA verifies no console errors in the drafting flow.

## Implementation Notes

Keep the first slice small:

1. Add draft types and local persistence.
2. Add Drafting Workspace component.
3. Rewire drafting buttons from chat to workspace.
4. Add generation helper using existing `/api/chat`.
5. Add export helpers for `.md`, `.txt`, `.html`, `.docx`, and protected/plain `.plt`.
6. Add focused tests/static checks where available.
7. Browser-verify the flow on `127.0.0.1:5173`.

Avoid broad refactors of `main.tsx` unless required. If the workspace makes `main.tsx` worse, extract into a focused component file as part of this slice.

## Open Decisions

- Whether to support `.ptl` as an alias for `.plt`. Current recommendation: keep `.plt`.
- Whether `.docx` should be implemented with a dependency or a minimal Word-compatible HTML/document approach first.
- Whether draft artifact `.plt` import is part of v1 or a follow-up.
