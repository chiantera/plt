# CURRENT TASK — PLT Pro analysis flow + web deployment

_Last updated: 2026-05-27 01:25 Europe/Berlin by Hermes/Turing_

## Current status

The previous active PLT task is complete and pushed to GitHub.

Target verified before updating this file:

- Repo: `/home/deckard/plt`
- Branch: `main`
- Remote: `origin https://github.com/chiantera/plt.git`
- Local/remote head at time of update: `6e300b7a6f2eb7dbfeaed844b4143422d7a3ec31`

Latest relevant commits on `main`:

```text
6e300b7a chore: build trigger fresh deploy
31f1e989 Add Pro analysis recommendation flow
cd413861 refactor(web): extract PLT domain utilities
b672b885 refactor(web): extract PLT prompt modules
7ff2111e refactor(web): extract PLT domain types
9ed9ad01 docs: inventory PLT path references
4b434782 docs: checkpoint PLT prompt and restructure plan
```

## Completed in this slice

- Added a Flash-vs-Pro analysis policy split in the backend.
- Added the `ProRecommendation` response model and integrated it into case analysis responses.
- Added Italian UI flow for **Approfondimento Pro con GiulIA**.
- Added explicit confirmation before Pro analysis runs.
- Preserved the no-auto-charge/no-automatic-Pro behavior.
- Restored and verified DOCX export disclaimers in Italian and English.
- Added backend tests covering Pro recommendations and mode-specific prompt policy.
- Built the frontend successfully.
- Pushed the changes to `chiantera/plt` `main`.
- Triggered a fresh Netlify deploy with a lightweight build-trigger commit.
- Verified public endpoints load:
  - Frontend: `https://pocket-legal-triage.netlify.app`
  - Backend health: `https://plt-backend.onrender.com/api/health`
  - Backend docs: `https://plt-backend.onrender.com/docs`

## Verification already run

Backend:

```text
pytest tests/test_pro_recommendation.py -q
4 passed in 0.06s

pytest -q
23 passed in 0.35s
```

Targeted suite:

```text
pytest -q tests/test_pro_recommendation.py tests/test_legal_schema.py tests/test_frontend_copy.py tests/test_demo_case.py tests/test_ocr_contract.py
21 passed in 0.26s
```

Frontend:

```text
npm run build
```

Result: build succeeded. Vite still reports the known large chunk warning for the main JS bundle; no TypeScript/build error.

Git hygiene:

```text
git diff --check
```

Result: clean.

## Current git state after this handoff update

This file was updated after the feature/deploy push. A follow-up cleanup slice has now been implemented for prompt safety, README freshness, frontend schema alignment, and temporary deploy-comment removal.

Before this edit, `git status --short --branch` was:

```text
## main...origin/main
```

## Is anything left to do?

No blocker remains for the completed Pro recommendation/deployment slice.

Cleanup slice completed after the deployment slice:

- Added verified-or-`DA VERIFICARE` Cassazione guardrails to backend default chat, frontend GiulIA system prompt, and document draft prompt tails.
- Refreshed `README.md` and `alpha-pwa/README.md` against the current alpha architecture and workflow.
- Aligned frontend types with backend legal-analysis fields: `feriale_applied`, `target_charge_id`, and nullable `evidence_balance`.
- Removed the temporary Netlify build-trigger comment from `alpha-pwa/frontend/src/main.tsx`.
- Refreshed `07-prompts/2026-05-26-plt-ai-prompts-map.md` against current source and the new prompt policy.
- The prompt map now records the current Flash/Pro policy split, Pro recommendation/confirmation gate, extracted frontend prompt modules, and the mostly mitigated Cassazione citation risk. Remaining production gap: no verified legal research/RAG source is connected, so lawyer/database verification remains required for specific precedents.

Earlier handoff work also updated `AGENT.md` and `AGENTS.md` so future Hermes/new-agent threads know the repo path, GitHub remote, current priorities, and critical PLT markdowns to read first.

Optional follow-ups:

1. **Authenticated E2E check:** log into the live Netlify app and run a fictional/demo case that should trigger the Pro recommendation card.
2. **Legal research/RAG:** connect verified legal research before ever treating specific Cassazione citations as reliable.
3. **Bundle splitting:** address Vite's >500 KB chunk warning with dynamic imports or Rollup `manualChunks`.
4. **Continue frontend restructuring:** keep extracting UI primitives/screens from `main.tsx`; do this before any `alpha-pwa` folder rename.
5. **Lawyer validation:** validate Pro recommendation copy and paid-flow expectations with real criminal-defense lawyers before expanding paid Pro flows.

## Guardrails for next PLT session

- Do not frame PLT as an “AI lawyer”.
- Keep lawyer control explicit; outputs are drafts, not decisions.
- Keep source-linked factual claims and confidence language.
- Keep **Anonimizza** for privacy/redaction and reserve **Redigi** for legal drafting.
- Do not expose provider/model plumbing in ordinary lawyer-facing UI copy.
- Do not commit generated artifacts (`dist`, Android build outputs, `.gradle`, `.netlify`, Python `.venv`).
- Redact secrets from summaries and docs; `netlify.toml` contains deploy/env values that must not be pasted raw.
