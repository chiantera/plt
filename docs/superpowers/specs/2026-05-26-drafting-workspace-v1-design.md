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
4. The lawyer can export a draft as `.plt` or `.docx` only. Do not add `.md`, `.txt`, or `.html` draft export in v1.
5. `.plt` export can be encrypted or plaintext using existing PLT Web Crypto logic.
6. `.docx` export must be implemented as a real Word-readable document by reusing/adapting the existing Promemoria DOCX path (`/api/export-brief`) rather than shipping fake renamed HTML.
7. Plain/unprotected export must make anonymization explicit and warn before exposing original sensitive data.
8. Drafting prompts must include a hard rule: never invent precedents or Cassazione citations.
9. The UI must surface verification warnings before deposit/use.

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
    last_export_format?: 'plt' | 'docx';
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

Storage guardrail for v1: cap an individual draft artifact at roughly 500 KB of Markdown/metadata, but do **not** impose a hard limit on the number of drafting workspaces per fascicolo. The user may create as many drafting workspaces as desired. If the count grows large, improve navigation with search/filter/archive affordances rather than blocking creation. If drafts become large or numerous enough to affect performance, move them to a separate IndexedDB object store keyed by `case_id` in a follow-up slice.

## UI Design

### Entry behavior

Drafting buttons should call a new handler, conceptually:

```ts
onOpenDraftWorkspace({ type, witnessId?, initialScope? })
```

They must not call `onOpenChat(...)`.

Every click on a purple drafting/preparation button creates a **new drafting workspace tab** for the current fascicolo. Existing draft tabs remain accessible. This is deliberate: a lawyer may want separate workspaces for alternative defensive theories, multiple memorie, separate witnesses, or different versions of a strategy. Do not silently reuse/overwrite an existing workspace unless the user explicitly chooses to revise that existing draft.

Workspace tab behavior:

- new tab title defaults from the lawyer-facing button/card title and timestamp/context, e.g. `Preparazione udienza — 26 mag 09:42`, `Memoria difensiva — 26 mag 09:42`, or `Controesame Testa — v1`;
- do not show internal classifier labels in the UI; if a label is needed, use the human document title already chosen by the button/card, otherwise omit it;
- tabs can be renamed by the user;
- the generated Markdown must use the same specific lawyer-facing title as its H1 heading. Do not emit generic type headings such as `# Analisi Strategica` when the selected action title is more specific, e.g. use `# Preparazione udienza` for a `Preparazione udienza di conferma`/hearing-preparation action;
- tabs persist with the fascicolo in local storage;
- closing a tab should mean hiding/archiving it, not deleting content without confirmation;
- deleted workspaces require explicit confirmation.

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
   - format selector limited to `.plt` and `.docx`
   - original vs anonymized copy
   - protected `.plt` vs plaintext `.plt`
   - password fields for protected `.plt`
   - DOCX download using the existing Promemoria-style backend conversion path
   - shortcut to whole-fascicolo protected `.plt` export when password protection is desired

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

### Prompt source strategy

V1 should reuse the current purple-button prompt tails as the drafting instructions for each document type. Today those tails live in `DOC_PROMPTS` and describe the desired output for `memoria`, `cassazione`, `eccezione`, `crossExam`, `strategy`, plus the witness-specific controesame prompt. Keep that useful legal drafting intent, but move it behind `generateDraftArtifact(...)` instead of sending it to the floating chat.

Implementation pattern:

- build case context from original or anonymized fascicolo;
- pass the selected action’s lawyer-facing title into generation as `requested_title`/`workspace_title`, separate from the internal `DraftType`;
- append the existing document-specific prompt tail for the selected purple button;
- prepend/append the global drafting guardrails from this spec, especially source-linking, lawyer-in-control copy, title fidelity, and the hard anti-invented-precedent rule;
- persist the result as a `DraftArtifact` in the new workspace tab.

Title fidelity rule:

- The model must infer the intended draft/preparation task from the specific workspace/action title, not only from the broad internal type. If the title says `Preparazione udienza di conferma`, the draft should be a hearing-preparation document; the Markdown should start with a specific heading such as `# Preparazione udienza` or `# Preparazione udienza di conferma`, not a generic `# Analisi Strategica`.
- Internal categories such as `strategy`, `crossExam`, or `memoria` are routing hints only. They must not leak into generic Markdown headings when the user-facing title is more precise.
- If the title is ambiguous, the model must not pretend certainty. It should open with a short confidence caveat such as: `Non sono pienamente certa di cosa significhi la prossima priorità "[titolo]"; ecco la mia lettura operativa e, in subordine, un'analisi strategica da verificare.` Then it should proceed with the best matching interpretation without inventing facts.

Do not rewrite the legal substance of the current prompts unless a prompt conflicts with the anti-invented-precedent policy. For example, prompt text that currently asks for `Precedenti della Cassazione Penale (sezione, numero, anno)` must be amended with `solo se verificabili; altrimenti DA VERIFICARE`.

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

- `.plt`: structured PLT whole-fascicolo container, including `caseData.draft_artifacts`. Can be encrypted or plaintext. Keep this as the only PLT-native exchange/backup format.
- `.docx`: Word-readable document for practical legal drafting use. Must be implemented in v1.

Do **not** implement `.md`, `.txt`, or `.html` draft downloads in v1. They add UI surface without improving the legal workflow enough for this slice.

Note: existing app convention is `.plt`, not `.ptl`. If `.ptl` is required later, add alias support deliberately; do not silently fork the format.

### Encryption

Use existing Web Crypto `.plt` encryption for protected exports:

- PBKDF2-HMAC-SHA256
- AES-256-GCM
- fresh salt/IV per export
- portable password-based container

For `.docx`, v1 exports are readable plaintext files. If the user asks for encryption for a Word document, direct them to export the whole fascicolo as a protected `.plt` container instead of pretending DOCX is encrypted.

Whenever the user exports a **non-encrypted** file (`.docx` or plaintext `.plt`), show a clear warning:

> Questo file non è cifrato. Chiunque lo riceva o lo apra potrà leggerne il contenuto. Se vuoi proteggere il materiale con password, esporta l’intero fascicolo come `.plt` protetto.

For `.docx`, the UI should not offer a fake encryption toggle. Instead it should offer a nearby action:

> Esporta fascicolo `.plt` protetto

This takes the user to the existing whole-fascicolo encrypted export flow, because the safest encrypted sharing unit is the full protected PLT container.

### Export payload

Use the existing whole-fascicolo `.plt` payload path. Draft artifacts are part of the case object:

```ts
type CaseAnalysis = {
  // existing fields...
  draft_artifacts?: DraftArtifact[];
};
```

When exporting `.plt`, call the existing full-case export path with the current `CaseAnalysis` after `draft_artifacts` has been persisted. This keeps `.plt` import/export simple: one portable case file, protected or plaintext, containing the fascicolo plus its drafting workspaces.

Existing `.plt` import already exists on the `I tuoi fascicoli` page: the `Importa` button reads `.plt`, calls `parsePltFile(...)`, asks for the password when `kind === 'encrypted'`, decrypts with `decryptPltContainer(...)`, and saves the result through `dbSave(...)`. Do not design a parallel import surface for drafts.

V1 decision: keep `.plt` as a whole-fascicolo container. Avoid standalone draft-only `.plt` unless a dedicated import/merge UX is explicitly implemented later.

### Anonymized export

For export, apply rules to the draft artifact itself, not only to the displayed case.

Redaction scope for draft export includes:

- draft title;
- Markdown body;
- claim text;
- source quotes/excerpts;
- source reference labels and filenames when they contain sensitive identifiers;
- generation notes and warning strings;
- DOCX core title/subject fields if generated by a library.

- if rules exist and export is plaintext, default to `Copia anonimizzata`;
- if no rules exist, offer `Apri Anonimizza`;
- if original + plaintext is selected, require explicit confirmation;
- encrypted `.plt` may default to original but still offers anonymized copy;
- every non-encrypted export surface must remind the user that password protection is available through whole-fascicolo `.plt` export.

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

DOCX is required in v1. Reuse/adapt the existing Promemoria export path instead of inventing a separate exporter:

- frontend reference: `exportBriefDocx` in `frontend/src/main.tsx` posts Markdown to `${API}/api/export-brief` and downloads the returned `.docx`;
- backend reference: `/api/export-brief` in `backend/app/main.py` uses `python-docx` (`Document`) to convert Markdown-ish text into a real Word document;
- implement draft DOCX export by generalizing that endpoint/helper to accept a draft title/content, or by adding a narrow sibling endpoint that shares the same conversion function;
- preserve title/metadata/anonymization handling;
- verify the downloaded file opens in LibreOffice/Word during QA.

Do not download fake `.docx` files that are actually HTML with a renamed extension.

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

1. Clicking each `Redazione atti con AI` card opens a new Drafting Workspace tab, not chat.
2. Witness `Prepara controesame con GiulIA` opens a new workspace tab with witness scope.
3. Generated draft is saved in `caseData.draft_artifacts`.
4. Draft persists after reload.
5. Anonymized generation uses `applyRedactionToCase` on the source context.
6. Anonymized export applies rules to the draft artifact content.
7. Plain original export shows a warning/confirmation.
8. Encrypted whole-fascicolo `.plt` export includes `draft_artifacts` and does not contain known sensitive strings in plaintext.
9. `.md`, `.txt`, and `.html` draft export options are absent in v1.
10. `.docx` export reuses/adapts the existing Promemoria `exportBriefDocx` / `/api/export-brief` / `python-docx` path and opens as a Word-readable document.
11. Non-encrypted `.docx` and plaintext `.plt` exports show the warning to use whole-fascicolo protected `.plt` export if encryption is desired.
12. Existing `I tuoi fascicoli` `.plt` import still accepts protected/plain `.plt` files after draft artifacts are added to the case model.
13. Drafting generation reuses the existing purple-button prompt tail for the selected document type, with anti-invented-precedent amendments where needed.
14. Drafting prompt passes the selected lawyer-facing title into generation and instructs the model to draft according to that title.
15. Generated Markdown H1 uses the specific workspace/action title, not a generic internal type heading; e.g. `Preparazione udienza di conferma` must not render as `# Analisi Strategica`.
16. Drafting prompt contains `DIVIETO ASSOLUTO: non inventare precedenti giurisprudenziali` or equivalent.
17. UI displays the precedent verification warning.
18. Every substantive generated claim is either source-linked or marked `DA VERIFICARE` / `unsupported` in the review panel.
19. Unsourced Cassazione-like citations are flagged `DA VERIFICARE` and not presented as verified.
20. Anonymized export contains no sensitive identifiers covered by active rules in title/body/source excerpts/metadata.
21. Draft status transitions persist and “approved” requires explicit user action.
22. Multiple clicks on purple drafting buttons create multiple persisted workspace tabs; none are overwritten silently.
23. Protected export validates password confirmation and preserves state on failure.
24. Frontend production build passes.
25. Browser QA verifies no console errors in the drafting flow.

## Implementation Notes

Keep the first slice small:

1. Add draft types and local persistence.
2. Add Drafting Workspace component.
3. Rewire drafting buttons from chat to workspace.
4. Add generation helper using existing `/api/chat`.
5. Add export helpers for `.docx` and protected/plain whole-fascicolo `.plt`; do not add `.md`, `.txt`, or `.html` draft exports in v1.
6. Add focused tests/static checks where available.
7. Browser-verify the flow on `127.0.0.1:5173`.

Avoid broad refactors of `main.tsx` unless required. If the workspace makes `main.tsx` worse, extract into a focused component file as part of this slice.

## Open Decisions

- Whether to support `.ptl` as an alias for `.plt`. Current recommendation: keep `.plt`.
- Whether draft-specific standalone `.plt` import/merge is needed later. V1 relies on existing whole-fascicolo `.plt` import on `I tuoi fascicoli`.
