# Encrypted PLT Export Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add default password-protected `.plt` export/import while keeping optional unprotected export, legacy import compatibility, and stronger Italian “Anonimizza” privacy UX.

**Architecture:** Extract PLT import/export container and Web Crypto code into frontend utility modules, then wire them into the existing case dashboard export/import flows. Keep the backend unchanged: encryption/decryption happens entirely in the browser.

**Tech Stack:** React/Vite/TypeScript, browser Web Crypto API, existing static Node regression scripts, existing IndexedDB/local case storage.

---

### Task 1: Add PLT container crypto utility tests

**Objective:** Define expected behavior for encrypted and plaintext PLT containers before implementation.

**Files:**
- Create: `alpha-pwa/frontend/scripts/check-plt-export-format.mjs`
- Modify: `alpha-pwa/frontend/package.json`
- Later create: `alpha-pwa/frontend/src/pltExport.ts`

**Step 1: Write failing test**

Create a Node script that imports future helpers from `../src/pltExport.ts` and tests:

- `exportPlainPlt(caseData)` returns `{ format, version, encrypted: false, payload }`.
- `exportEncryptedPlt(caseData, password)` returns `{ encrypted: true, kdf, cipher, payload }`.
- encrypted output JSON does not contain sentinel strings like `Mario Rossi` or `Furto aggravato`.
- `parsePltFile()` accepts legacy raw case JSON.
- decrypting with correct password returns original case.
- decrypting with wrong password throws `Password errata o file danneggiato.`.

**Step 2: Run test to verify failure**

```bash
cd alpha-pwa/frontend
npm run test:plt-export
```

Expected: FAIL because script/helper does not exist.

**Step 3: Wire package script**

Add:

```json
"test:plt-export": "node --experimental-strip-types scripts/check-plt-export-format.mjs"
```

**Step 4: Re-run to verify expected missing-module failure**

Expected: FAIL due to missing `src/pltExport.ts`.

---

### Task 2: Implement browser/Node-compatible PLT crypto helpers

**Objective:** Implement tested `.plt` container generation, parsing, encryption, and decryption.

**Files:**
- Create: `alpha-pwa/frontend/src/pltExport.ts`
- Test: `alpha-pwa/frontend/scripts/check-plt-export-format.mjs`

**Implementation requirements:**

- Constants:
  - `PLT_FORMAT = 'pocket-legal-triage.case'`
  - `PLT_VERSION = 1`
  - `PBKDF2_ITERATIONS = 600000`
- Use `globalThis.crypto.subtle`.
- Base64 helpers must work in browser and Node.
- `exportPlainPlt(caseData)` returns new plaintext container.
- `exportEncryptedPlt(caseData, password)` returns encrypted container.
- `parsePltFile(text)` returns typed result:
  - legacy raw case object;
  - plaintext container payload;
  - encrypted container metadata requiring password.
- `decryptPltContainer(container, password)` returns case object or throws Italian error.

**Verification:**

```bash
cd alpha-pwa/frontend
npm run test:plt-export
```

Expected: PASS.

---

### Task 3: Replace Redigi terminology with Anonimizza

**Objective:** Correct Italian terminology across UI copy without changing behavior yet.

**Files:**
- Modify: `alpha-pwa/frontend/src/main.tsx`
- Modify/create static copy test if needed: `alpha-pwa/frontend/scripts/check-auth-onboarding.mjs` or new script

**Step 1: Write failing copy regression**

Add checks that:

- `Anonimizza` appears.
- `Redigi` does not appear as button/control copy.
- `redatta`/`redazione` UI labels are replaced with `anonimizzata`/`anonimizzazione` where user-facing.

**Step 2: Run test to verify failure.**

**Step 3: Update copy:**

- `Redigi` → `Anonimizza`
- `Redatto` → `Anonimizzato` or `Vista anonimizzata`
- `Gestione redazione dati` → `Anonimizza dati sensibili`
- `Attiva modalità redatta` → `Mostra vista anonimizzata`

Keep internal function names unless easy to rename safely; behavior matters first.

**Step 4: Re-run copy test.**

Expected: PASS.

---

### Task 4: Make Anonimizza button visually prominent

**Objective:** Turn anonymization into a visible privacy action, not a quiet ghost button.

**Files:**
- Modify: `alpha-pwa/frontend/src/main.tsx`
- Modify: `alpha-pwa/frontend/src/styles.css`
- Modify: `alpha-pwa/frontend/scripts/check-layout-and-contrast-css.mjs`

**Step 1: Add failing CSS/static regression**

Check that the anonymize button class includes:

- a dedicated class such as `anonymize-action-btn`;
- gradient or multi-color accent styling;
- high-contrast text color;
- focus-visible outline;
- does not rely only on color for active state.

**Step 2: Run test to verify failure.**

**Step 3: Update toolbar button:**

Use visible label:

```tsx
<ShieldCheck size={13} />
Anonimizza
```

When anonymized view is active:

```tsx
<EyeOff size={13} />
Vista anonimizzata
```

If enabled rules exist, add count: `Anonimizza · {count}`.

**Step 4: Add CSS**

Use restrained rainbow/security gradient: violet → blue → emerald, white text, box-shadow/glow, hover transform, accessible focus ring.

**Step 5: Re-run layout/contrast regression.**

---

### Task 5: Add export modal state and Italian copy

**Objective:** Replace the tiny export dropdown with a modal/drawer that defaults to protected export and explains password portability.

**Files:**
- Modify: `alpha-pwa/frontend/src/main.tsx`
- Modify: `alpha-pwa/frontend/src/styles.css`
- Add/modify static copy test

**Step 1: Write failing static copy test**

Check for required copy:

- `Proteggi con password — consigliato`
- `Chi riceve il file potrà aprirlo su un altro dispositivo, ma solo con questa password.`
- `PLT non salva il file e non conosce la password.`
- `Esporta senza password`
- `Prima di inviare un .plt non protetto, usa “Anonimizza”`

**Step 2: Run test to verify failure.**

**Step 3: Implement modal state**

Add state:

- `showExportModal`
- `exportIncludeDocs`
- `exportMode: 'protected' | 'unprotected'`
- `exportPassword`
- `exportPasswordConfirm`
- `exportUseAnonymizedCopy`

**Step 4: Implement modal component/markup**

Prefer existing drawer/modal patterns. Keep mobile-first layout.

**Step 5: Re-run copy test.**

---

### Task 6: Wire encrypted and unprotected export behavior

**Objective:** Make export modal produce correct `.plt` files.

**Files:**
- Modify: `alpha-pwa/frontend/src/main.tsx`
- Use: `alpha-pwa/frontend/src/pltExport.ts`
- Test: `alpha-pwa/frontend/scripts/check-plt-export-format.mjs`

**Step 1: Add failing behavior/static tests where possible**

Ensure main imports helper names and no longer directly creates raw JSON blob in `handleExport`.

**Step 2: Update export logic**

- Build export case object from original or anonymized copy depending on mode.
- Encrypted export uses original case by default.
- Unprotected export warns and defaults to anonymized copy if rules exist.
- Preserve `includeDocs` behavior.
- Strip `redaction_rules`/`analyzed_doc_ids` unless deliberately exporting anonymization metadata.

**Step 3: Validate password UX**

- Require password.
- Require confirmation match.
- Show Italian error toast.

**Step 4: Verify utility tests and build.**

---

### Task 7: Wire encrypted import behavior

**Objective:** Import encrypted, plaintext-container, and legacy `.plt` files.

**Files:**
- Modify: `alpha-pwa/frontend/src/main.tsx`
- Use: `alpha-pwa/frontend/src/pltExport.ts`

**Step 1: Write failing import-copy/static test**

Check for:

- `Fascicolo protetto`
- `Sblocca e importa`
- `Password errata o file danneggiato.`
- legacy unprotected warning copy.

**Step 2: Implement import flow**

- Read file text.
- `parsePltFile(text)`.
- Legacy/plaintext imports continue directly, with warning for unprotected files.
- Encrypted import opens password prompt/modal.
- Correct password decrypts and saves via `dbSave`.
- Wrong password shows clean Italian error.

**Step 3: Re-run tests.**

---

### Task 8: Full verification and commit

**Objective:** Prove the feature is safe enough for the alpha and commit it.

**Commands:**

```bash
cd alpha-pwa/frontend
npm run test:plt-export
npm run test:question-layout
npm run test:date-formatters
npm run test:auth-onboarding
npm run build
```

```bash
cd alpha-pwa/backend
./.venv/bin/pytest
```

Then browser-verify:

- export modal opens from case page;
- Anonimizza button is visible and not tacky-broken;
- encrypted export downloads `.plt`;
- import with correct password succeeds;
- wrong password fails;
- legacy plaintext import still works.

Commit:

```bash
git add alpha-pwa/frontend/src/main.tsx alpha-pwa/frontend/src/styles.css alpha-pwa/frontend/src/pltExport.ts alpha-pwa/frontend/scripts/check-plt-export-format.mjs alpha-pwa/frontend/package.json docs/superpowers/specs/2026-05-25-encrypted-plt-export-design.md docs/plans/2026-05-25-encrypted-plt-export.md
git commit -m "feat: add protected plt export design and implementation"
```
