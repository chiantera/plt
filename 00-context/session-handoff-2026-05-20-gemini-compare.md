# Session Handoff — Gemini PLT branch comparison
_Last updated: 2026-05-20 02:49_

Timestamp captured with `date -Is`: 2026-05-20T00:24:41-04:00

## User request
Deckard has a Gemini-created pass of the PLT app:

- Local checkout: `/home/deckard/gemini-plt`
- GitHub branch: `https://github.com/chiantera/plt/tree/gemini-plt`
- Gemini app running at: `http://127.0.0.1:5179/`
- Our app still live at: `http://127.0.0.1:5178/`
- Gemini wrote notes at: `/home/deckard/gemini-plt/WHATIDID.md`

Task: inspect everything, decide what to keep/drop, merge useful improvements into `/home/deckard/plt` without losing our local uncommitted work, improve especially UI design, test heavily, move toward production readiness.

## Skills already loaded this turn
- `using-superpowers`
- `github-code-review`
- `using-git-worktrees`
- `verification-before-completion`
- `mobile-legal-product-alpha`

Attempts to load bare `systematic-debugging`, `test-driven-development`, and `requesting-code-review` failed because names are ambiguous; use categorized paths if needed.

## Current local repo state: `/home/deckard/plt`
Command run: `git status --short --branch && git branch --show-current && git log --oneline -5`

```text
## main...origin/main
 M .gitignore
 M 00-context/active-context.md
 M 00-context/change-log.md
 M README.md
 M alpha-pwa/README.md
 M alpha-pwa/frontend/package.json
 M alpha-pwa/frontend/src/main.tsx
 M alpha-pwa/frontend/src/styles.css
?? .github/commands/
?? .github/workflows/gemini-dispatch.yml
?? .github/workflows/gemini-invoke.yml
?? .github/workflows/gemini-plan-execute.yml
?? .github/workflows/gemini-review.yml
?? .github/workflows/gemini-scheduled-triage.yml
?? .github/workflows/gemini-triage.yml
?? 00-context/session-handoff-2026-05-19.md
?? alpha-pwa/frontend/scripts/
branch: main
last commit: bf84592d chore: ignore local secrets and build artifacts
```

Local diff stat before this handoff file:

```text
.gitignore                        |   3 ++
00-context/active-context.md      |  27 ++++++----
00-context/change-log.md          |  15 ++++++
README.md                         |  28 +++++++++-
alpha-pwa/README.md               |  23 ++++++--
alpha-pwa/frontend/package.json   |   2 +-
alpha-pwa/frontend/src/main.tsx   | 108 +++++++++++++++++++++-----------------
alpha-pwa/frontend/src/styles.css |  95 +++++++++++++++++++++++++++++----
8 files changed, 227 insertions(+), 74 deletions(-)
```

Untracked local files before this handoff file:

```text
.github/commands/gemini-invoke.toml
.github/commands/gemini-plan-execute.toml
.github/commands/gemini-review.toml
.github/commands/gemini-scheduled-triage.toml
.github/commands/gemini-triage.toml
.github/workflows/gemini-dispatch.yml
.github/workflows/gemini-invoke.yml
.github/workflows/gemini-plan-execute.yml
.github/workflows/gemini-review.yml
.github/workflows/gemini-scheduled-triage.yml
.github/workflows/gemini-triage.yml
00-context/session-handoff-2026-05-19.md
alpha-pwa/frontend/scripts/check-auth-onboarding.mjs
```

Important: these are real local uncommitted changes from earlier Hermes work, not Gemini. Do not clobber. The known recent UX change: post-login onboarding was removed; orientation/legal safety copy moved into login; regression script `npm run test:auth-onboarding` added.

## Gemini checkout state: `/home/deckard/gemini-plt`
Command run: `git status --short --branch && git branch --show-current && git log --oneline -5`

```text
## gemini-plt...origin/gemini-plt
branch: gemini-plt
last commit: 721693af feat: architectural and UX upgrades for alpha-pwa
base before Gemini: bf84592d chore: ignore local secrets and build artifacts
```

Gemini branch diff vs `bf84592d`:

```text
A Please_read_all_the_markdowns_and_the_whole_code....md
A WHATIDID.md
M alpha-pwa/backend/app/ai_service.py
M alpha-pwa/backend/app/main.py
M alpha-pwa/backend/app/models.py
M alpha-pwa/backend/requirements.txt
M alpha-pwa/frontend/package-lock.json
M alpha-pwa/frontend/package.json
A alpha-pwa/frontend/postcss.config.js
M alpha-pwa/frontend/src/db.ts
M alpha-pwa/frontend/src/main.tsx
M alpha-pwa/frontend/src/styles.css
A alpha-pwa/frontend/tailwind.config.js
```

Gemini branch stat vs `bf84592d`:

```text
13 files changed, 884 insertions(+), 159 deletions(-)
```

## Gemini WHATIDID summary
Read `/home/deckard/gemini-plt/WHATIDID.md`. Gemini claims:

1. Added backend dependencies: `aiofiles`, `python-pptx`, `openpyxl`.
2. Refactored `/api/upload` to stream uploads to temp files instead of loading entire payload into memory.
3. Wrapped sync extractors in `fastapi.concurrency.run_in_threadpool`.
4. Added legal model fields:
   - `DefenseStrategy.target_charge_id`
   - `ProceduralDeadline.feriale_applied`
5. Updated `ai_service.py` schema/prompt for those fields.
6. Added Dexie/offline IndexedDB wiring for cases/tasks/appState.
7. Added Tailwind/PostCSS config and package deps, but apparently mostly setup only; existing CSS remains.
8. WARNING: Gemini says it copied real env keys from `/home/deckard/plt` into `/home/deckard/gemini-plt/alpha-pwa/frontend/.env` and backend `.env`. Do not display or commit secrets. Check `.gitignore` before any add/commit.

## Ports/processes observed
Command run: `ss -ltnp | grep -E ':(5178|5179|8000|8001)\b' || true`

```text
0.0.0.0:8000       users:(("python",pid=1402559),("uvicorn",pid=1242406))
127.0.0.1:5178     users:(("MainThread",pid=1701862))
127.0.0.1:5179     users:(("MainThread",pid=1920819))
```

Need verify which backend each frontend targets before browser QA. Do not assume port 8000 belongs to the desired checkout.

## Immediate next steps
1. Inspect Gemini diffs file-by-file, especially:
   - `alpha-pwa/backend/app/main.py` upload/refactor correctness and temp-file cleanup.
   - `alpha-pwa/frontend/src/db.ts` because our repo already has a `db.ts`; Gemini changed it substantially.
   - `alpha-pwa/frontend/src/main.tsx` conflicts with our local auth/onboarding UX changes.
   - Tailwind config: likely keep only if actually used; adding Tailwind without using it may add maintenance noise.
2. Run automated comparison commands:
   - In `/home/deckard/gemini-plt`: `git diff bf84592d..HEAD -- alpha-pwa/backend/app/main.py`
   - Same for `ai_service.py`, `models.py`, `src/db.ts`, `src/main.tsx`, `styles.css`, package files.
3. Use browser QA on both live apps:
   - Our version: `http://127.0.0.1:5178/`
   - Gemini version: `http://127.0.0.1:5179/`
   - Check mobile viewport visually if possible, console errors, login/dashboard routing, upload path if safe sample doc exists.
4. Preserve our local changes before integrating. Safer options:
   - Create a patch: `git diff > /tmp/plt-local-before-gemini.patch` plus list untracked files.
   - Or commit local work first if Deckard allows; but user did not explicitly ask to commit.
5. Decide keep/drop candidates. Preliminary suspicion:
   - Potentially keep backend streaming/threadpool improvements if tests pass and cleanup is sound.
   - Potentially keep legal schema fields if prompts/tests updated and UI can display or ignore safely.
   - Be skeptical of Tailwind setup unless real UI modernization follows.
   - Be careful merging `main.tsx`; preserve our login orientation/no post-login onboarding behavior and `test:auth-onboarding`.
6. Verification gate before claiming success:
   - backend tests, frontend type/build, auth-onboarding test, git diff --check, browser load both target ports, console check, possibly security secret scan.

## Decisions made after initial inventory
Subagent/code/browser reviews found:

- Backend Gemini work is directionally useful but not mergeable as-is:
  - good: upload streaming/temp-file direction, threadpool offload, legal schema precision fields;
  - bad: successful PDF/PPTX/XLSX extraction can be mislabeled `needs_ocr` because output starts with `[Pagina ...]`/`[Slide ...]`;
  - missing: upload size cap.
- Frontend Gemini work should be dropped as-is:
  - keeps post-login onboarding gate/`plt_onboarded`, conflicting with our UX decision;
  - Dexie migration is partial and lacks migration/backfill;
  - Tailwind is mostly plumbing, not real UI modernization;
  - live app at 5179 has weaker login/product framing than our 5178 version;
  - user observed Gemini new-fascicolo flow behaves like demo/no real AI/GiulIA placeholder.

## Work completed after initial inventory
Implemented selected backend improvements in `/home/deckard/plt` while preserving our frontend/auth work:

- Added `aiofiles` to backend requirements and installed it into the local backend venv.
- Refactored `/api/upload` to stream uploads to a temp file, then run document extraction via `run_in_threadpool`.
- Added `MAX_UPLOAD_BYTES` / `PLT_MAX_UPLOAD_BYTES` cap, default 50 MiB.
- Fixed upload status classification to use extraction success/readiness instead of `extracted_text.startswith("[")`.
- Added tests:
  - successful page-prefixed PDF extraction returns `status == "ready"`;
  - oversized uploads return HTTP 413;
  - `ProceduralDeadline.feriale_applied` default;
  - `DefenseStrategy.target_charge_id` charge linkage.
- Added legal schema/prompt fields:
  - `ProceduralDeadline.feriale_applied`;
  - `DefenseStrategy.target_charge_id`;
  - prompt instructions for capi d'imputazione, charge linkage, and feriale handling as lawyer-verified candidates.

## Verification run after backend integration
Commands and observed results:

```text
/home/deckard/plt/alpha-pwa/backend$ ./.venv/bin/python -m pytest tests/test_ocr_contract.py::test_upload_marks_successful_page_prefixed_pdf_extraction_ready -q
FAILED before fix: status was needs_ocr instead of ready
```

```text
/home/deckard/plt/alpha-pwa/backend$ ./.venv/bin/python -m pytest tests/test_legal_schema.py -q
FAILED before schema fields: missing feriale_applied and target_charge_id
```

```text
/home/deckard/plt/alpha-pwa/backend$ ./.venv/bin/python -m pytest -q
15 passed in 0.39s
```

```text
/home/deckard/plt/alpha-pwa/frontend$ npm run test:auth-onboarding
PASS: 4 checks
```

```text
/home/deckard/plt/alpha-pwa/frontend$ npm run build
PASS, same Vite >500k chunk warning remains
```

```text
/home/deckard/plt$ git diff --check
PASS after trimming EOF whitespace
```

## Caveats / next steps
- This handoff itself is a new untracked file in `/home/deckard/plt/00-context/`.
- `.hermes-safety/` contains a safety patch/list snapshot of local uncommitted state.
- `.antigravitycli/` is also currently untracked; inspect before committing.
- Need still run browser QA against the modified 5178 server after backend/frontend restart if required. Current live 5178 may not include backend code changes until server restart.
- Need independent final review/security scan before claiming production-ready.
- Production-ready is not achieved yet; this is an incremental verified integration step.
