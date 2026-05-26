# CURRENT TASK — PLT AI-app prompts + renaming/restructuring

_Last updated: 2026-05-26 13:xx Europe/Berlin by Hermes/Turing_

## Purpose

Resume the PLT renaming/restructuring work in a way that survives context loss, Telegram compression, OpenAI rate limits, or model restarts.

User intent:
- Keep this new Telegram thread focused on **PLT AI-app prompts** and related architecture cleanup.
- Continue the **sensible renaming/restructuring** task.
- Save often, commit coherent slices often, and leave enough markdown state here for a later session to resume without guessing.

## Target repo

- Repo: `/home/deckard/plt`
- Branch: `main`
- Remote: `origin https://github.com/chiantera/plt.git`
- Current app path: `alpha-pwa/`
  - Frontend: `alpha-pwa/frontend` — React/Vite/TypeScript/Capacitor
  - Backend: `alpha-pwa/backend` — FastAPI/Pydantic

## Current git state at start of this thread

`git status --short --untracked-files=all` showed:

```text
?? .hermes/plans/2026-05-26_134436-plt-sensible-renaming-and-architecture.md
?? 07-prompts/2026-05-26-plt-ai-prompts-map.md
```

Recent commits:

```text
c2cec545 Respect priority titles in draft prompts
877abc0a Add drafting title fidelity rule
f830d330 Polish drafting workspace label copy
2d18327c Persist generated draft workspace updates safely
b03d5ad0 Route deadline preparation to draft workspace
```

## Existing plan to execute

Primary plan file:

- `.hermes/plans/2026-05-26_134436-plt-sensible-renaming-and-architecture.md`

Important judgment from the plan and PLT skill:

- Do **not** rename `alpha-pwa` first.
- First extract architecture from the huge frontend files while paths are stable.
- Then do the mechanical folder move to `apps/web` + `apps/api`.
- Keep product names unchanged: **Pocket Legal Triage**, **PLT**, `.plt`, **GiulIA**.
- Keep redaction language Italian-correct: **Anonimizza** for privacy/redaction; reserve **Redigi** for legal drafting.

## High-level execution order

1. Preserve current dirty/untracked work.
2. Commit the current planning/prompt-map docs as a safe checkpoint.
3. Create a path/reference inventory for `alpha-pwa`, `frontend`, `backend`, deploy/test/doc references.
4. Start Phase 1 extraction before folder rename:
   - `src/domain/types.ts`
   - `src/domain/caseContext.ts`
   - `src/domain/caseMerge.ts`
   - `src/domain/redaction.ts`
   - `src/prompts/*`
   - later UI primitives/screens/styles
5. Run targeted frontend checks after each slice.
6. Commit each coherent slice.
7. Keep this file updated after each slice with:
   - files changed
   - commands run and result
   - next exact step
   - known blockers

## Immediate next steps

### Step A — Save/commit documentation checkpoint

Files expected:
- `.hermes/plans/2026-05-26_134436-plt-sensible-renaming-and-architecture.md`
- `07-prompts/2026-05-26-plt-ai-prompts-map.md`
- `CURRENT-TASK.md`

Command:

```bash
cd /home/deckard/plt
git add CURRENT-TASK.md .hermes/plans/2026-05-26_134436-plt-sensible-renaming-and-architecture.md 07-prompts/2026-05-26-plt-ai-prompts-map.md
git commit -m "docs: checkpoint PLT prompt and restructure plan"
```

### Step B — Create path/reference inventory

Create:
- `docs/plans/2026-05-26-plt-path-reference-inventory.md`

Command pattern:

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

Then classify references as:
- path/config requiring update;
- product copy to keep;
- generated artifact to ignore/regenerate;
- legacy docs note.

Commit:

```bash
git add docs/plans/2026-05-26-plt-path-reference-inventory.md CURRENT-TASK.md
git commit -m "docs: inventory PLT path references"
```

### Step C — First code slice: extract domain types

Create:
- `alpha-pwa/frontend/src/domain/types.ts`

Modify:
- `alpha-pwa/frontend/src/main.tsx`
- possibly `alpha-pwa/frontend/src/draftArtifacts.ts`, `db.ts`, `pltExport.ts` if type imports are needed

Move/export from `main.tsx`:
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

Verify:

```bash
cd /home/deckard/plt/alpha-pwa/frontend
npm run build
```

Expected:
- TypeScript passes.
- Vite may still warn about chunk size; that is acceptable until later extraction/lazy-loading.

Commit:

```bash
cd /home/deckard/plt
git add alpha-pwa/frontend/src/domain/types.ts alpha-pwa/frontend/src/main.tsx CURRENT-TASK.md
git commit -m "refactor(web): extract PLT domain types"
```

## Verification commands to use over the full restructuring run

Frontend:

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

Backend, before/after folder moves:

```bash
cd /home/deckard/plt/alpha-pwa/backend
.venv/bin/python -m pytest tests -q
```

## Current progress log

### 2026-05-26 — New Telegram thread recovery

Completed:
- Loaded PLT legal-product skill and renaming/refactor reference.
- Found existing detailed plan in `.hermes/plans/2026-05-26_134436-plt-sensible-renaming-and-architecture.md`.
- Confirmed dirty/untracked state consists of two untracked docs before creating this file.
- Created this `CURRENT-TASK.md` as restart/rate-limit handoff.

Completed:
- Documentation checkpoint committed: `4b434782 docs: checkpoint PLT prompt and restructure plan`.
- Created path/reference inventory: `docs/plans/2026-05-26-plt-path-reference-inventory.md`.

In progress:
- Commit path/reference inventory.

Next exact action:
- Commit `docs/plans/2026-05-26-plt-path-reference-inventory.md` plus this updated handoff.
- Then start Step C: extract `alpha-pwa/frontend/src/domain/types.ts` from `main.tsx`.

## Caution notes

- This repo is on `main`; user explicitly said “YOU ONLY LIVE ONCE”, but still keep commits coherent and reversible.
- Do not mix generated artifacts (`dist`, Android `build`, `.gradle`, `.netlify`, Python `.venv`) into refactor commits.
- Do not rename `alpha-pwa` before extracting the worst `main.tsx`/`styles.css` structure.
- Do not turn PLT into an “AI lawyer” in docs/copy.
- Do not expose provider/model plumbing in normal lawyer-facing UI copy.
