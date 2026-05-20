# Change Log

## 2026-05-14

Created and organized `/home/deckard/plt` workspace.

Initial files moved:

- `active-context.md` → `00-context/active-context.md`
- `product-spec.md` → `01-product/product-spec.md`
- `research-notes.md` → `02-research/research-notes.md`
- `pricing-unit-economics.md` → `03-business/pricing-unit-economics.md`

Added root/project files:

- `README.md`
- `AGENT.md`
- `AGENTS.md`
- `SOUL.md`

Added product, architecture, validation, brand, and prompt notes, including:

- `01-product/feature-map.md`
- `01-product/ux-flows.md`
- `04-technical/architecture.md`
- `04-technical/data-model.md`
- `04-technical/model-routing.md`
- `04-technical/ocr-strategy.md`
- `05-validation/validation-plan.md`
- `06-brand/landing-page-draft.md`
- `06-brand/positioning.md`
- `07-prompts/extraction-prompts.md`
- `00-context/open-questions.md`

Alpha work:

- Created `/home/deckard/plt/alpha-pwa` thin PWA alpha.
- Implemented Italian fictional criminal-defense demo case.
- Added private backend `.env` using existing Hermes DeepSeek API key without exposing it.
- Added `.gitignore` so `.env`, venvs, DBs, uploads, node modules, and builds are ignored.
- Updated OCR direction: use dedicated DeepSeek-OCR/local OCR adapter as primary OCR path, not V4 Flash/Pro as the OCR workhorse.

Current direction:

- mobile-first criminal-defense triage;
- Italy first, US expansion;
- DeepSeek V4 Flash default for extraction/structuring;
- DeepSeek V4 Pro fallback/deep reasoning;
- dedicated OCR adapter, likely DeepSeek-OCR 3B/local after validation;
- no unlimited heavy processing;
- source-linked outputs;
- validate before building.

## 2026-05-19

Production-readiness/browser-QA checkpoint:

- Added `00-context/session-handoff-2026-05-19.md` with current diff, verification output, browser findings, and next steps.
- Added a localhost-only `VITE_BYPASS_AUTH=true` auth bypass in `alpha-pwa/frontend/src/main.tsx` for local QA/demo work; deployed hosts still use Supabase auth.
- Updated stale markdowns to stop claiming broad tested/production-ready status prematurely.
- Documented the local port pitfall: in this environment, `5173` was occupied by an unrelated D&D Vite app; use the URL printed by Vite or an explicit PLT port.
- Verified `npm run build` for the frontend succeeded, with a Vite chunk-size warning.
- Verified `git diff --check` succeeded.
- Found current blockers before production-ready language: missing frontend lint/e2e scripts, backend tests need a venv with `pytest`, generic browser JS exception needs investigation, and onboarding copy/flow need hardening.
- Moved the onboarding/product orientation into the login screen and removed the post-login onboarding gate so login goes straight to the case dashboard.
- Added `frontend/scripts/check-auth-onboarding.mjs` plus `npm run test:auth-onboarding` to guard that the login page contains the orientation copy and no `plt_onboarded` gate returns.
- Verified the auth/onboarding check, frontend production build, real Supabase login → dashboard flow, and zero browser-console errors after that login flow on preview port `5182`.

## 2026-05-20

Gemini branch triage and selected integration:

- Compared `/home/deckard/gemini-plt` / branch `gemini-plt` against our dirty `/home/deckard/plt` working tree and live apps on `5179` vs `5178`.
- Wrote `00-context/session-handoff-2026-05-20-gemini-compare.md` so the comparison survives compaction.
- Preserved local uncommitted state in `.hermes-safety/` patch/list files before integrating anything.
- Decision: drop Gemini frontend changes as-is because they keep the post-login onboarding gate, weaken login/product framing, and appear to keep new-fascicolo/GiulIA behavior on the demo/mock path.
- Decision: keep a corrected subset of Gemini backend changes: temp-file upload streaming, threadpool extraction, legal schema precision fields.
- Added `aiofiles` requirement and local venv package.
- Refactored `/api/upload` to stream uploads, enforce a 50 MiB default `PLT_MAX_UPLOAD_BYTES` cap, clean temp files, and classify `ready` based on extraction success rather than `[`-prefixed text.
- Added tests for page-prefixed successful PDF extraction status, oversized-upload rejection, `feriale_applied`, and `target_charge_id`.
- Updated AI schema/prompt for capo-specific defense strategies and feriale deadline tracking as candidate/legal-review fields.
- Verified: backend `15 passed`, frontend `npm run test:auth-onboarding` passed, frontend `npm run build` passed with the existing chunk warning, `git diff --check` passed, and an independent backend review found no critical issues.
