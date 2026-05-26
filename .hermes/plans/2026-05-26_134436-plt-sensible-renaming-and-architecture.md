# PLT Sensible Renaming and Architecture Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task. Treat this as a planning/architecture refactor, not a cosmetic rename spree.

**Goal:** Rename PLT internals so the repository reads like a serious product instead of a temporary alpha, while using the rename as a controlled first step toward smaller frontend chunks and a clearer app architecture.

**Architecture:** Keep the public product name **Pocket Legal Triage / PLT**. Rename only repository/app folders and code modules in staged slices. The biggest technical smell is not merely `alpha-pwa`; it is `frontend/src/main.tsx` at ~4,280 lines / ~205 KB plus `styles.css` at ~1,632 lines / ~84 KB, producing a single Vite bundle around ~556 KB. The folder rename should happen after import/path/test stability is locked down, or in the same small PR as only path/docs/config changes.

**Tech Stack:** React 19 + Vite 6 + TypeScript frontend; FastAPI + Pydantic backend; Capacitor Android; IndexedDB local-first storage; DeepSeek/Mistral/Anthropic provider routing.

---

## Current context from repo inspection

Target repo: `/home/deckard/plt`

Git state at planning time:
- Branch: `main`
- Remote: `origin https://github.com/chiantera/plt.git`
- Status: `main...origin/main [ahead 3]`
- Untracked: `07-prompts/2026-05-26-plt-ai-prompts-map.md`

Current app path:
- `alpha-pwa/backend` — FastAPI service
- `alpha-pwa/frontend` — React/Vite/Capacitor client
- `alpha-pwa/sample-data`, `alpha-pwa/docs`

Important measured source sizes:
- `alpha-pwa/frontend/src/main.tsx`: 4,280 lines, ~205 KB
- `alpha-pwa/frontend/src/styles.css`: 1,632 lines, ~84 KB
- `alpha-pwa/backend/app/main.py`: 390 lines, ~15 KB
- `alpha-pwa/backend/app/ai_service.py`: 323 lines, ~15 KB
- Current built frontend JS artifact observed: `frontend/dist/assets/index-C4B9G6iK.js`, ~556 KB
- Stale/generated Capacitor asset also exists: `frontend/android/app/src/main/assets/public/assets/index-Cf1ashMs.js`, ~603 KB

Existing config/scripts:
- `alpha-pwa/frontend/package.json` scripts:
  - `dev`: `vite --host 127.0.0.1`
  - `build`: `tsc -b && vite build`
  - `preview`: `vite preview --host 127.0.0.1`
  - static regression scripts for auth, dates, layout/contrast, export, local case scope, draft workspace
- `alpha-pwa/frontend/vite.config.ts` has no chunking config beyond React plugin and `/api` proxy.

Important product constraints:
- Do not frame PLT as an AI lawyer.
- Keep lawyer in control.
- Candidate deadlines remain visibly unconfirmed until verified.
- Use `Anonimizza` for privacy/redaction; reserve `Redigi` for drafting.
- Legal drafting shortcuts should create durable draft artifacts/workspace tabs, not dump giant prompts into chat.

---

## Naming decision

### Folder name: change `alpha-pwa`, but not blindly

`alpha-pwa` is probably due for replacement. It served its purpose, but it now undersells the project and leaks a temporary state into docs, deploy scripts, tests, and mental model.

Recommended final structure:

```text
plt/
  apps/
    web/                 # current React/Vite/Capacitor PWA frontend
    api/                 # current FastAPI backend
  packages/
    shared/              # later: shared schemas/types/prompts if useful
  docs/
  00-context/
  01-product/
  ...
```

Why `apps/web` and `apps/api`:
- It is boring in the good way.
- It avoids premature product labels like `pro`, `studio`, `lawyer-app`, or `client-app`.
- It leaves room for future surfaces: `apps/mobile`, `apps/worker`, `apps/admin`, `apps/demo`.
- It makes the app architecture clearer than `alpha-pwa/frontend/backend`.

Acceptable intermediate if we want lower disruption:

```text
plt/
  app/
    frontend/
    backend/
```

But I do **not** recommend this long term. It is only a path rename, not an architecture rename.

### Product/code names to keep

Keep:
- `Pocket Legal Triage`
- `PLT`
- `.plt` file extension/format names
- `GiulIA` if this is the intended assistant persona

Do not rename the public product while doing filesystem cleanup. Product naming is a branding exercise; app-folder naming is architecture hygiene. Mixing them will create unnecessary churn.

---

## Strategy: order matters

Do this in three small waves:

1. **Stabilize and map references** — no moving files yet.
2. **Extract architecture from `main.tsx`/`styles.css`** — reduce bundle and make paths meaningful.
3. **Rename `alpha-pwa` to `apps/web` + `apps/api`** — once the code is not a single giant file and tests know the new paths.

Reason: if we rename first while `main.tsx` is still a 4,280-line god component, every later extraction diff gets harder to review. If we extract first with path aliases and tests, the final folder move is mostly mechanical.

---

## Phase 0 — Safety baseline before any rename

### Task 0.1: Preserve current work

**Objective:** Avoid clobbering the untracked prompt map and ahead-of-origin commits.

**Files:** none modified unless creating a patch snapshot.

**Steps:**
1. Run:
   ```bash
   cd /home/deckard/plt
   git status --short --branch
   git log --oneline --decorate --max-count=8
   ```
2. If there are uncommitted/untracked files unrelated to the rename, either commit them or create a named patch/inventory.
3. Do not start a path migration with unrelated dirty work mixed into the same diff.

**Verification:** `git status --short` is understood and intentionally clean or intentionally contains only known files.

### Task 0.2: Create a rename/reference inventory

**Objective:** Know every `alpha-pwa`, `frontend`, and `backend` reference before moving paths.

**Files:**
- Create: `docs/plans/2026-05-26-plt-path-reference-inventory.md`

**Commands:**
```bash
cd /home/deckard/plt
rg -n "alpha-pwa|cd frontend|cd backend|frontend/|backend/|plt-alpha-backend|Pocket Legal Triage Alpha" \
  --glob '!**/node_modules/**' \
  --glob '!**/.venv/**' \
  --glob '!**/dist/**' \
  --glob '!**/build/**' \
  --glob '!**/.gradle/**' \
  . > docs/plans/2026-05-26-plt-path-reference-inventory.md
```

**Expected:** A finite list including README paths, tests like `backend/tests/test_frontend_copy.py`, FastAPI service label, and Capacitor config copies.

**Verification:** Open the inventory and classify each reference as:
- path/config requiring update;
- product copy to keep;
- generated artifact to ignore/regenerate.

---

## Phase 1 — Make frontend modules real before moving folders

### Task 1.1: Extract shared domain types

**Objective:** Move PLT case/domain types out of `frontend/src/main.tsx` into a stable module.

**Files:**
- Create: `alpha-pwa/frontend/src/domain/types.ts`
- Modify: `alpha-pwa/frontend/src/main.tsx`

**Move from `main.tsx`:**
- `SourceRef`
- `Material`
- `TimelineEvent`
- `Person`
- `EvidenceItem`
- `OpenQuestion`
- `MissingDocument`
- `Contradiction`
- `ProceduralDeadline`
- `UsageEstimate`
- `ChargeElement`
- `ChargeAnalysis`
- `DefenseStrategy`
- `ConstitutionalIssue`
- `WitnessAssessment`
- `EvidenceBalance`
- `LegalAnalysis`
- `RawDocument`
- `UploadQueueItem`
- `RedactionRule`
- `CaseAnalysis`
- `CaseSummary`
- `TabId`
- `ChatMsg`
- `ChatState`
- `UserProfile`

**Implementation note:** export all moved types. Update imports in `main.tsx`, `draftArtifacts.ts`, `db.ts`, `pltExport.ts` if/when type duplication appears.

**Verification:**
```bash
cd /home/deckard/plt/alpha-pwa/frontend
npm run build
```
Expected: TypeScript passes. Vite may still warn about chunk size; that is expected at this point.

### Task 1.2: Extract case-context and merge/redaction utilities

**Objective:** Remove pure functions from `main.tsx` so UI extraction is safer.

**Files:**
- Create: `alpha-pwa/frontend/src/domain/caseContext.ts`
- Create: `alpha-pwa/frontend/src/domain/caseMerge.ts`
- Create: `alpha-pwa/frontend/src/domain/redaction.ts`
- Modify: `alpha-pwa/frontend/src/main.tsx`

**Move:**
- `buildCaseContext` → `domain/caseContext.ts`
- `caseAnalysisToSummary` → `domain/caseContext.ts` or `domain/caseSummary.ts`
- `buildUserContextMaterial` → `domain/caseContext.ts`
- `mergeArrays`, `mergeWithAi` → `domain/caseMerge.ts`
- `redactString`, `redactObj`, `applyRedactionToCase`, `mergeRedactionRules` → `domain/redaction.ts`

**Verification:**
```bash
cd /home/deckard/plt/alpha-pwa/frontend
npm run build
npm run test:plt-export
npm run test:local-case-scope
```

### Task 1.3: Extract prompt constants and prompt builders

**Objective:** Keep AI-app prompts visible and auditable, instead of buried inside the React entrypoint.

**Files:**
- Create: `alpha-pwa/frontend/src/prompts/giulia.ts`
- Create: `alpha-pwa/frontend/src/prompts/redaction.ts`
- Create: `alpha-pwa/frontend/src/prompts/documentDrafts.ts`
- Modify: `alpha-pwa/frontend/src/main.tsx`
- Cross-check: `07-prompts/2026-05-26-plt-ai-prompts-map.md`

**Move:**
- `DOC_PROMPTS`
- `REDACT_DETECT_PROMPT`
- `REDACT_APPLY_PROMPT`
- `SYSTEM_PROMPT_IT`
- any local drafting prompt tails not already in `draftArtifacts.ts`

**Naming rule:** prompt file names should describe legal product behavior, not model/provider plumbing.

**Verification:**
```bash
cd /home/deckard/plt/alpha-pwa/frontend
npm run build
npm run test:draft-workspace
npm run test:draft-workspace-ui
```

### Task 1.4: Extract UI primitives

**Objective:** Break reusable controls out before extracting major screens.

**Files:**
- Create: `alpha-pwa/frontend/src/components/ui/Editable.tsx`
- Create: `alpha-pwa/frontend/src/components/ui/EditableSelect.tsx`
- Create: `alpha-pwa/frontend/src/components/ui/EditablePercent.tsx`
- Create: `alpha-pwa/frontend/src/components/ui/EditableStringList.tsx`
- Create: `alpha-pwa/frontend/src/components/ui/SourceBadge.tsx`
- Create: `alpha-pwa/frontend/src/components/ui/SourceDrawer.tsx`
- Create: `alpha-pwa/frontend/src/components/ui/MaterialDrawer.tsx`
- Modify: `alpha-pwa/frontend/src/main.tsx`

**Move from `main.tsx`:**
- `ToastNotification`
- `SourceBadge`
- `SourceRow`
- `StrengthBar`
- `Editable`
- `RowDelete`
- `AddRowButton`
- `EditableSelect`
- `EditablePercent`
- `EditableStringList`
- `SourceDrawer`
- `MaterialDrawer`
- `RawDocDrawer`

**Verification:**
```bash
cd /home/deckard/plt/alpha-pwa/frontend
npm run build
npm run test:question-layout
```

### Task 1.5: Extract major screens and drawers

**Objective:** Make `main.tsx` only bootstrap + top-level routing/app state.

**Files:**
- Create: `alpha-pwa/frontend/src/screens/AuthScreen.tsx`
- Create: `alpha-pwa/frontend/src/screens/CaseListView.tsx`
- Create: `alpha-pwa/frontend/src/screens/CaseDetailView.tsx`
- Create: `alpha-pwa/frontend/src/features/chat/ChatDrawer.tsx`
- Create: `alpha-pwa/frontend/src/features/drafting/DraftingWorkspace.tsx`
- Create: `alpha-pwa/frontend/src/features/redaction/RedactionDrawer.tsx`
- Create: `alpha-pwa/frontend/src/features/export/ExportCaseDrawer.tsx`
- Create: `alpha-pwa/frontend/src/features/aula/AulaModeOverlay.tsx`
- Modify: `alpha-pwa/frontend/src/main.tsx`

**Move from `main.tsx`:**
- `AuthScreen`
- `ProfileDrawer`
- `GiuliaPromptBar`
- `CaseListView`
- `LegalAnalysisTab`
- `RedactionDrawer`
- `AnonModal`
- `ExportCaseDrawer`
- `DraftingWorkspace`
- `CaseDetailView`
- `ChatDrawer`
- `FloatingChatButton`
- `AulaModeOverlay`
- `HomepageStats`

**Verification:**
```bash
cd /home/deckard/plt/alpha-pwa/frontend
npm run build
npm run test:auth-onboarding
npm run test:date-formatters
npm run test:question-layout
npm run test:plt-export
npm run test:local-case-scope
npm run test:draft-workspace
npm run test:draft-workspace-ui
```

### Task 1.6: Split CSS by feature without changing visuals

**Objective:** Stop `styles.css` from being the other god file.

**Files:**
- Create: `alpha-pwa/frontend/src/styles/base.css`
- Create: `alpha-pwa/frontend/src/styles/layout.css`
- Create: `alpha-pwa/frontend/src/styles/auth.css`
- Create: `alpha-pwa/frontend/src/styles/case-list.css`
- Create: `alpha-pwa/frontend/src/styles/case-detail.css`
- Create: `alpha-pwa/frontend/src/styles/legal-analysis.css`
- Create: `alpha-pwa/frontend/src/styles/drafting.css`
- Create: `alpha-pwa/frontend/src/styles/redaction-export.css`
- Create: `alpha-pwa/frontend/src/styles/chat.css`
- Create: `alpha-pwa/frontend/src/styles/aula.css`
- Modify: `alpha-pwa/frontend/src/styles.css` to import these files, or replace it with `src/styles/index.css`.

**Rule:** This phase is pure movement. No redesign. No color changes. No class renames unless tests require it.

**Verification:**
```bash
cd /home/deckard/plt/alpha-pwa/frontend
npm run build
npm run test:question-layout
```

Then run browser QA at mobile and desktop widths before claiming visual parity.

---

## Phase 2 — Address Vite oversized chunks honestly

### Task 2.1: Add bundle analysis script

**Objective:** Measure before prescribing chunk splits.

**Files:**
- Modify: `alpha-pwa/frontend/package.json`

**Recommended scripts:**
```json
{
  "scripts": {
    "build:analyze": "tsc -b && vite build --mode analyze"
  }
}
```

If using a visualizer, add `rollup-plugin-visualizer` as a dev dependency and configure it only for analyze mode. If avoiding new deps, keep a simple size-check Node script that reports `dist/assets/*.js` sizes.

**Verification:**
```bash
cd /home/deckard/plt/alpha-pwa/frontend
npm run build
```

### Task 2.2: Lazy-load heavyweight feature screens

**Objective:** Turn the current one-big-entry bundle into meaningful route/feature chunks.

**Files:**
- Modify: `alpha-pwa/frontend/src/main.tsx`
- Modify extracted screen files from Phase 1

**Targets for `React.lazy`:**
- `CaseDetailView`
- `DraftingWorkspace`
- `AulaModeOverlay`
- possibly `ChatDrawer` if not needed on initial dashboard paint

**Do not lazy-load:**
- tiny UI primitives
- types/utilities
- critical auth/dashboard shell

**Verification:**
```bash
cd /home/deckard/plt/alpha-pwa/frontend
npm run build
```

Expected: multiple JS chunks instead of one large `index-*.js`. Initial chunk should shrink substantially. Vite may still warn if one feature chunk remains >500 KB; then inspect actual chunk contents before manual splitting.

### Task 2.3: Consider manual chunks only after lazy-loading

**Objective:** Avoid fake fixes that merely hide Vite warnings.

**Files:**
- Modify: `alpha-pwa/frontend/vite.config.ts`

**Possible config:**
```ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        react: ['react', 'react-dom'],
        supabase: ['@supabase/supabase-js'],
        icons: ['lucide-react'],
      },
    },
  },
}
```

**Caution:** manual chunks are secondary. The real win is extracting and lazy-loading feature surfaces. Do not split `lucide-react` blindly if tree-shaking already keeps icons small; measure first.

---

## Phase 3 — Rename filesystem once architecture is stable

### Task 3.1: Move app directories

**Objective:** Replace `alpha-pwa/frontend` and `alpha-pwa/backend` with stable architecture paths.

**Files/directories:**
- Move: `alpha-pwa/frontend` → `apps/web`
- Move: `alpha-pwa/backend` → `apps/api`
- Move: `alpha-pwa/sample-data` → `sample-data` or `apps/api/sample-data` depending on usage
- Move: `alpha-pwa/docs` → `docs/legacy-alpha` or fold active plans into `docs/plans`
- Remove: empty `alpha-pwa` after references are updated

**Preferred commands:**
```bash
cd /home/deckard/plt
mkdir -p apps
git mv alpha-pwa/frontend apps/web
git mv alpha-pwa/backend apps/api
git mv alpha-pwa/sample-data sample-data
mkdir -p docs/legacy-alpha
git mv alpha-pwa/docs/* docs/legacy-alpha/
rmdir alpha-pwa/docs alpha-pwa
```

Adjust if any directory is untracked/generated.

**Verification:**
```bash
cd /home/deckard/plt
git status --short
```
Expected: mostly renames, not delete/add chaos. If Git does not detect renames because files changed too much, stop and split the commit.

### Task 3.2: Update scripts and docs paths

**Objective:** Make local/dev/deploy commands work from the new paths.

**Files likely to change:**
- `README.md`
- `AGENTS.md`
- `AGENT.md`
- `apps/web/package.json`
- `apps/web/vite.config.ts`
- `apps/web/capacitor.config.json`
- `apps/api/app/main.py` service label if desired
- `apps/api/tests/test_frontend_copy.py`
- `.github/workflows/*` if present
- Netlify config if present
- Render config if present
- docs under `00-context`, `04-technical`, `07-prompts`, and `docs/plans` that contain runnable paths

**Path replacements:**
- `alpha-pwa/frontend` → `apps/web`
- `alpha-pwa/backend` → `apps/api`
- `cd alpha-pwa/frontend` → `cd apps/web`
- `cd alpha-pwa/backend` → `cd apps/api`

**Product copy:** Keep `Pocket Legal Triage` and `PLT` unchanged.

**Verification:**
```bash
cd /home/deckard/plt
rg -n "alpha-pwa|cd frontend|cd backend|frontend/|backend/" \
  --glob '!**/node_modules/**' \
  --glob '!**/.venv/**' \
  --glob '!**/dist/**' \
  --glob '!**/build/**' \
  --glob '!**/.gradle/**' \
  .
```
Remaining references must be intentional legacy notes or generated files.

### Task 3.3: Update test path assumptions

**Objective:** Fix tests that know the old nested layout.

**Files likely to change:**
- `apps/api/tests/test_frontend_copy.py`
- any tests that use `parents[2] / "frontend"`
- frontend static test scripts if they refer to old relative paths

**Verification:**
```bash
cd /home/deckard/plt/apps/api
.venv/bin/python -m pytest tests -q

cd /home/deckard/plt/apps/web
npm run build
npm run test:auth-onboarding
npm run test:date-formatters
npm run test:question-layout
npm run test:plt-export
npm run test:local-case-scope
npm run test:draft-workspace
npm run test:draft-workspace-ui
```

### Task 3.4: Update deployment configs

**Objective:** Prevent Netlify/Render from deploying the old paths.

**Files to inspect/update:**
- `.github/workflows/*`
- `netlify.toml` if present
- Render dashboard config if not committed
- `apps/web/package.json`
- `apps/api/requirements.txt`

**Expected Netlify settings:**
- Base directory: `apps/web`
- Build command: `npm run build`
- Publish directory: `dist`

**Expected Render settings:**
- Root directory: `apps/api`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

**Verification:** Deploy preview/build logs reference `apps/web` and `apps/api`, not `alpha-pwa`.

---

## Phase 4 — Optional cleanup after rename

### Task 4.1: Introduce workspace-level scripts

**Objective:** Make commands less path-sensitive.

**Files:**
- Create/modify root `package.json` if wanted, or a `Makefile`.

**Possible root scripts:**
```json
{
  "scripts": {
    "web:dev": "npm --prefix apps/web run dev",
    "web:build": "npm --prefix apps/web run build",
    "api:test": "cd apps/api && .venv/bin/python -m pytest tests -q",
    "check": "npm --prefix apps/web run build && cd apps/api && .venv/bin/python -m pytest tests -q"
  }
}
```

**Caution:** Do not introduce a monorepo toolchain unless needed. npm `--prefix` is enough for now.

### Task 4.2: Add chunk-size regression check

**Objective:** Stop oversized chunks from creeping back silently.

**Files:**
- Create: `apps/web/scripts/check-bundle-size.mjs`
- Modify: `apps/web/package.json`

**Behavior:** after `vite build`, read `dist/assets/*.js`; fail if the initial app chunk exceeds an agreed threshold, e.g. 350 KB gzip or 500 KB raw.

**Verification:**
```bash
cd /home/deckard/plt/apps/web
npm run build
node scripts/check-bundle-size.mjs
```

---

## Risks and tradeoffs

### Risk: folder rename breaks deploy

Mitigation:
- Update Netlify/Render config in the same commit as the move.
- Verify with local build and deploy logs.
- Keep the move commit mechanically small.

### Risk: code extraction changes behavior

Mitigation:
- Extract pure types/utilities first.
- Run existing static regression scripts after each slice.
- Browser QA mobile and desktop before claiming visual parity.

### Risk: Vite chunk warning gets “fixed” cosmetically

Mitigation:
- Do not start with `manualChunks` as the primary solution.
- First split `main.tsx` into real feature modules and lazy-load screens.
- Measure built artifacts.

### Risk: generated/build artifacts pollute rename diff

Mitigation:
- Ignore or remove generated `dist`, Android `build`, `.gradle`, `.netlify`, and Python `.venv` artifacts from rename planning.
- Do not commit generated Capacitor asset copies unless intentionally rebuilding the Android app.

### Risk: docs become stale immediately

Mitigation:
- Update runnable path docs only.
- Avoid rewriting every product doc in this rename pass.
- Add a root “current architecture” section that supersedes old alpha docs.

---

## Recommended commit sequence

1. `docs: add PLT renaming and architecture plan`
2. `refactor(web): extract PLT domain types`
3. `refactor(web): extract case utilities and prompt modules`
4. `refactor(web): extract reusable UI components`
5. `refactor(web): extract major feature screens`
6. `refactor(web): split stylesheet by feature`
7. `perf(web): lazy-load heavyweight PLT screens`
8. `chore(repo): move alpha app to apps web and api`
9. `chore(repo): update path docs and deployment config`
10. `test(web): add bundle size regression check`

---

## My recommendation

Take the lead with this order:

1. Do **not** rename `alpha-pwa` as the very first move.
2. First cut `main.tsx` and `styles.css` into sane modules while paths are still stable.
3. Then rename the app into `apps/web` and `apps/api` in one mechanical commit.
4. Only then add chunk-size enforcement.

The folder name is stale, yes. But the Vite warning is the more honest architecture signal. `alpha-pwa` is a label problem; `main.tsx` is a load-bearing wall made of spaghetti. Fix the wall before repainting the address plaque.
