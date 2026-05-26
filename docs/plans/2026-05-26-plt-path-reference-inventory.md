# PLT Path Reference Inventory

Date: 2026-05-26
Repo: /home/deckard/plt
Purpose: classify references before renaming alpha-pwa -> apps/web + apps/api.

## Raw matches

```text
./netlify.toml:2:  base    = "alpha-pwa/frontend"
./README.md:60:**Working alpha PWA** in [`alpha-pwa/`](./alpha-pwa/).
./README.md:83:cd alpha-pwa/backend
./README.md:99:cd alpha-pwa/frontend
./README.md:148:alpha-pwa/          Working alpha PWA: FastAPI + React/Vite
./AGENT.md:15:A working alpha PWA exists at `alpha-pwa/`:
./AGENT.md:19:- See `alpha-pwa/README.md` for setup instructions
./AGENT.md:65:alpha-pwa/          Working alpha PWA
./CURRENT-TASK.md:19:- Current app path: `alpha-pwa/`
./CURRENT-TASK.md:20:  - Frontend: `alpha-pwa/frontend` — React/Vite/TypeScript/Capacitor
./CURRENT-TASK.md:21:  - Backend: `alpha-pwa/backend` — FastAPI/Pydantic
./CURRENT-TASK.md:50:- Do **not** rename `alpha-pwa` first.
./CURRENT-TASK.md:60:3. Create a path/reference inventory for `alpha-pwa`, `frontend`, `backend`, deploy/test/doc references.
./CURRENT-TASK.md:102:rg -n "alpha-pwa|cd frontend|cd backend|frontend/|backend/|plt-alpha-backend|Pocket Legal Triage Alpha" \
./CURRENT-TASK.md:127:- `alpha-pwa/frontend/src/domain/types.ts`
./CURRENT-TASK.md:130:- `alpha-pwa/frontend/src/main.tsx`
./CURRENT-TASK.md:131:- possibly `alpha-pwa/frontend/src/draftArtifacts.ts`, `db.ts`, `pltExport.ts` if type imports are needed
./CURRENT-TASK.md:164:cd /home/deckard/plt/alpha-pwa/frontend
./CURRENT-TASK.md:176:git add alpha-pwa/frontend/src/domain/types.ts alpha-pwa/frontend/src/main.tsx CURRENT-TASK.md
./CURRENT-TASK.md:185:cd /home/deckard/plt/alpha-pwa/frontend
./CURRENT-TASK.md:199:cd /home/deckard/plt/alpha-pwa/backend
./CURRENT-TASK.md:223:- Do not rename `alpha-pwa` before extracting the worst `main.tsx`/`styles.css` structure.
./04-technical/deepseek-ocr-tooling-evaluation.md:79:backend/app/ocr_models.py      # OcrResult, OcrPage, OcrWarning
./04-technical/deepseek-ocr-tooling-evaluation.md:80:backend/app/ocr_adapter.py     # interface + placeholder/local stub
./04-technical/deepseek-ocr-tooling-evaluation.md:81:backend/tests/test_ocr_contract.py
./04-technical/deepseek-ocr-tooling-evaluation.md:87:backend/app/ocr_deepseek_local.py
./04-technical/deepseek-ocr-tooling-evaluation.md:88:backend/app/ocr_deepseek_rs_client.py
./04-technical/model-routing.md:17:If both are set, DeepSeek takes priority. Logic lives in `alpha-pwa/backend/app/ai_service.py`.
./alpha-pwa/README.md:83:cd alpha-pwa/backend
./alpha-pwa/README.md:105:# alpha-pwa/backend/.env — do not commit
./alpha-pwa/README.md:121:cd alpha-pwa/frontend
./alpha-pwa/README.md:167:cd alpha-pwa/backend
./alpha-pwa/README.md:177:cd alpha-pwa/frontend
./alpha-pwa/README.md:188:backend/
./alpha-pwa/README.md:196:frontend/
./alpha-pwa/docs/procedural-deadlines-implementation-plan.md:19:- Modify: `backend/tests/test_demo_case.py`
./alpha-pwa/docs/procedural-deadlines-implementation-plan.md:30:- Modify: `backend/app/models.py`
./alpha-pwa/docs/procedural-deadlines-implementation-plan.md:31:- Modify: `backend/app/demo_data.py`
./alpha-pwa/docs/procedural-deadlines-implementation-plan.md:45:- Modify: `frontend/src/main.tsx`
./alpha-pwa/docs/procedural-deadlines-implementation-plan.md:46:- Modify: `frontend/src/styles.css`
./alpha-pwa/docs/procedural-deadlines-implementation-plan.md:60:- `backend/.venv/bin/python -m pytest backend/tests -q`
./alpha-pwa/docs/implementation-notes.md:10:- `/home/deckard/plt/alpha-pwa/backend`
./alpha-pwa/docs/implementation-notes.md:15:- `/home/deckard/plt/alpha-pwa/frontend`
./alpha-pwa/docs/implementation-notes.md:21:- `/home/deckard/plt/alpha-pwa/sample-data`
./00-context/active-context.md:6:Working alpha PWA at `alpha-pwa/`. Core product surfaces exist, but do **not** call the app production-ready yet: the latest checkpoint found missing repeatable lint/e2e scripts, backend tests require a venv with `pytest`, and browser QA still shows a generic JS exception that needs root-cause investigation.
./00-context/active-context.md:15:### Backend (`alpha-pwa/backend/`)
./00-context/active-context.md:22:- Backend tests exist under `alpha-pwa/backend/tests/`; verified command: `cd alpha-pwa/backend && ./.venv/bin/python -m pytest -q`.
./00-context/active-context.md:26:### Frontend (`alpha-pwa/frontend/`)
./00-context/active-context.md:40:cd alpha-pwa/backend
./00-context/active-context.md:47:cd alpha-pwa/frontend
./00-context/active-context.md:62:- Backend tests run cleanly now (`15 passed`), but still need broader frontend/e2e coverage and final release gate.
./01-product/thin-pwa-alpha-plan.md:206:`/home/deckard/plt/alpha-pwa/`
./01-product/thin-pwa-alpha-plan.md:211:alpha-pwa/
./01-product/thin-pwa-alpha-plan.md:212:├── frontend/
./01-product/thin-pwa-alpha-plan.md:213:├── backend/
./00-context/change-log.md:38:- Created `/home/deckard/plt/alpha-pwa` thin PWA alpha.
./00-context/change-log.md:60:- Added a localhost-only `VITE_BYPASS_AUTH=true` auth bypass in `alpha-pwa/frontend/src/main.tsx` for local QA/demo work; deployed hosts still use Supabase auth.
./00-context/change-log.md:67:- Added `frontend/scripts/check-auth-onboarding.mjs` plus `npm run test:auth-onboarding` to guard that the login page contains the orientation copy and no `plt_onboarded` gate returns.
./00-context/session-handoff-2026-05-20-gemini-compare.md:35: M alpha-pwa/README.md
./00-context/session-handoff-2026-05-20-gemini-compare.md:36: M alpha-pwa/frontend/package.json
./00-context/session-handoff-2026-05-20-gemini-compare.md:37: M alpha-pwa/frontend/src/main.tsx
./00-context/session-handoff-2026-05-20-gemini-compare.md:38: M alpha-pwa/frontend/src/styles.css
./00-context/session-handoff-2026-05-20-gemini-compare.md:47:?? alpha-pwa/frontend/scripts/
./00-context/session-handoff-2026-05-20-gemini-compare.md:59:alpha-pwa/README.md               |  23 ++++++--
./00-context/session-handoff-2026-05-20-gemini-compare.md:60:alpha-pwa/frontend/package.json   |   2 +-
./00-context/session-handoff-2026-05-20-gemini-compare.md:61:alpha-pwa/frontend/src/main.tsx   | 108 +++++++++++++++++++++-----------------
./00-context/session-handoff-2026-05-20-gemini-compare.md:62:alpha-pwa/frontend/src/styles.css |  95 +++++++++++++++++++++++++++++----
./00-context/session-handoff-2026-05-20-gemini-compare.md:81:alpha-pwa/frontend/scripts/check-auth-onboarding.mjs
./00-context/session-handoff-2026-05-20-gemini-compare.md:92:last commit: 721693af feat: architectural and UX upgrades for alpha-pwa
./00-context/session-handoff-2026-05-20-gemini-compare.md:101:M alpha-pwa/backend/app/ai_service.py
./00-context/session-handoff-2026-05-20-gemini-compare.md:102:M alpha-pwa/backend/app/main.py
./00-context/session-handoff-2026-05-20-gemini-compare.md:103:M alpha-pwa/backend/app/models.py
./00-context/session-handoff-2026-05-20-gemini-compare.md:104:M alpha-pwa/backend/requirements.txt
./00-context/session-handoff-2026-05-20-gemini-compare.md:105:M alpha-pwa/frontend/package-lock.json
./00-context/session-handoff-2026-05-20-gemini-compare.md:106:M alpha-pwa/frontend/package.json
./00-context/session-handoff-2026-05-20-gemini-compare.md:107:A alpha-pwa/frontend/postcss.config.js
./00-context/session-handoff-2026-05-20-gemini-compare.md:108:M alpha-pwa/frontend/src/db.ts
./00-context/session-handoff-2026-05-20-gemini-compare.md:109:M alpha-pwa/frontend/src/main.tsx
./00-context/session-handoff-2026-05-20-gemini-compare.md:110:M alpha-pwa/frontend/src/styles.css
./00-context/session-handoff-2026-05-20-gemini-compare.md:111:A alpha-pwa/frontend/tailwind.config.js
./00-context/session-handoff-2026-05-20-gemini-compare.md:132:8. WARNING: Gemini says it copied real env keys from `/home/deckard/plt` into `/home/deckard/gemini-plt/alpha-pwa/frontend/.env` and backend `.env`. Do not display or commit secrets. Check `.gitignore` before any add/commit.
./00-context/session-handoff-2026-05-20-gemini-compare.md:147:   - `alpha-pwa/backend/app/main.py` upload/refactor correctness and temp-file cleanup.
./00-context/session-handoff-2026-05-20-gemini-compare.md:148:   - `alpha-pwa/frontend/src/db.ts` because our repo already has a `db.ts`; Gemini changed it substantially.
./00-context/session-handoff-2026-05-20-gemini-compare.md:149:   - `alpha-pwa/frontend/src/main.tsx` conflicts with our local auth/onboarding UX changes.
./00-context/session-handoff-2026-05-20-gemini-compare.md:152:   - In `/home/deckard/gemini-plt`: `git diff bf84592d..HEAD -- alpha-pwa/backend/app/main.py`
./00-context/session-handoff-2026-05-20-gemini-compare.md:184:Implemented selected backend improvements in `/home/deckard/plt` while preserving our frontend/auth work:
./00-context/session-handoff-2026-05-20-gemini-compare.md:204:/home/deckard/plt/alpha-pwa/backend$ ./.venv/bin/python -m pytest tests/test_ocr_contract.py::test_upload_marks_successful_page_prefixed_pdf_extraction_ready -q
./00-context/session-handoff-2026-05-20-gemini-compare.md:209:/home/deckard/plt/alpha-pwa/backend$ ./.venv/bin/python -m pytest tests/test_legal_schema.py -q
./00-context/session-handoff-2026-05-20-gemini-compare.md:214:/home/deckard/plt/alpha-pwa/backend$ ./.venv/bin/python -m pytest -q
./00-context/session-handoff-2026-05-20-gemini-compare.md:219:/home/deckard/plt/alpha-pwa/frontend$ npm run test:auth-onboarding
./00-context/session-handoff-2026-05-20-gemini-compare.md:224:/home/deckard/plt/alpha-pwa/frontend$ npm run build
./00-context/session-handoff-2026-05-20-gemini-compare.md:237:- Need still run browser QA against the modified 5178 server after backend/frontend restart if required. Current live 5178 may not include backend code changes until server restart.
./00-context/session-handoff-2026-05-19.md:14:- `alpha-pwa/frontend/src/main.tsx`
./00-context/session-handoff-2026-05-19.md:25:alpha-pwa/frontend/src/main.tsx | 22 ++++++++++++++++++++++
./00-context/session-handoff-2026-05-19.md:35:cd /home/deckard/plt/alpha-pwa/frontend
./00-context/session-handoff-2026-05-19.md:56:cd /home/deckard/plt/alpha-pwa/backend
./00-context/session-handoff-2026-05-19.md:66:cd /home/deckard/plt/alpha-pwa/frontend
./00-context/session-handoff-2026-05-19.md:152:   - Start backend/frontend as tracked background processes from `/home/deckard/plt/alpha-pwa`.
./00-context/session-handoff-2026-05-19.md:189:- Added `alpha-pwa/frontend/scripts/check-auth-onboarding.mjs` and `npm run test:auth-onboarding` to guard the new behavior.
./render.yaml:5:    rootDir: alpha-pwa/backend
./AGENTS.md:16:Working alpha PWA at `alpha-pwa/`. See `alpha-pwa/README.md` for full setup guide.
./AGENTS.md:33:alpha-pwa/     Working alpha PWA (FastAPI + React/Vite)
./07-prompts/2026-05-26-plt-ai-prompts-map.md:4:Project inspected: `/home/deckard/plt/alpha-pwa`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:15:   - Backend prompt: `backend/app/ai_service.py`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:21:   - Backend system default: `backend/app/ai_service.py`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:22:   - Frontend often passes `system_override`: `frontend/src/main.tsx`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:42:File: `alpha-pwa/backend/app/ai_service.py:23-53`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:56:File: `alpha-pwa/backend/app/ai_service.py:261-267`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:71:File: `alpha-pwa/backend/app/ai_service.py:300-307`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:84:File: `alpha-pwa/backend/app/ai_service.py:274-279`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:97:File: `alpha-pwa/backend/app/ai_service.py:315-320`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:116:File: `alpha-pwa/frontend/src/main.tsx:125-172`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:194:File: `alpha-pwa/frontend/src/main.tsx:265-290`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:233:File: `alpha-pwa/backend/app/ai_service.py:58-71`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:280:File: `alpha-pwa/backend/app/ai_service.py:73-101` and `194-214`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:293:File: `alpha-pwa/frontend/src/main.tsx:3233-3237`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:315:- File: `alpha-pwa/backend/app/ai_service.py:181-193`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:404:File: `alpha-pwa/backend/app/ai_service.py:103-128`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:464:File: `alpha-pwa/frontend/src/main.tsx:4074-4113`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:521:File: `alpha-pwa/frontend/src/main.tsx:4190-4203`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:556:File: `alpha-pwa/frontend/src/main.tsx:4175-4179`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:583:File: `alpha-pwa/frontend/src/main.tsx:200-202`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:623:File: `alpha-pwa/frontend/src/main.tsx:203-204`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:659:File: `alpha-pwa/frontend/src/main.tsx:205-206`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:694:File: `alpha-pwa/frontend/src/main.tsx:207-208`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:733:File: `alpha-pwa/frontend/src/main.tsx:209-210`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:769:File: `alpha-pwa/frontend/src/main.tsx:211-212`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:802:File: `alpha-pwa/frontend/src/main.tsx:4160-4169`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:835:File: `alpha-pwa/frontend/src/draftArtifacts.ts:47-58`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:869:File: `alpha-pwa/frontend/src/draftArtifacts.ts:123-152`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:918:File: `alpha-pwa/frontend/src/main.tsx:3058-3062`, `3088-3121`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:940:File: `alpha-pwa/frontend/src/draftArtifacts.ts:155-194`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:951:File: `alpha-pwa/frontend/src/main.tsx:2250-2259` and `3091-3093`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:991:File: `alpha-pwa/frontend/src/main.tsx:3469-3481`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:1032:File: `alpha-pwa/frontend/src/main.tsx:3832-3835`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:1069:File: `alpha-pwa/frontend/src/main.tsx:3907-3911`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:1102:File: `alpha-pwa/frontend/src/main.tsx:365-397`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:1153:File: `alpha-pwa/frontend/src/main.tsx:2394-2400`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:1189:File: `alpha-pwa/frontend/src/main.tsx:399-400`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:1218:File: `alpha-pwa/frontend/src/main.tsx:3183-3193`, `3195-3211`, `3058-3062`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:1253:File: `alpha-pwa/frontend/src/main.tsx:2338-2364`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:1283:File: `alpha-pwa/frontend/src/main.tsx:1216-1223`, `1248-1254`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:1312:File: `alpha-pwa/backend/app/ocr_adapter.py:230-283`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:1347:File: `alpha-pwa/backend/app/main.py:301-322`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:1441:- `alpha-pwa/backend/app/ai_service.py`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:1442:- `alpha-pwa/backend/app/main.py`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:1443:- `alpha-pwa/backend/app/ocr_adapter.py`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:1444:- `alpha-pwa/frontend/src/main.tsx`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:1445:- `alpha-pwa/frontend/src/draftArtifacts.ts`
./07-prompts/2026-05-26-plt-ai-prompts-map.md:1447:Generated/build artifacts under `frontend/dist/` were not treated as source of truth because they are compiled from the source files above.
./alpha-pwa/backend/app/main.py:25:app = FastAPI(title="Pocket Legal Triage Alpha", version="0.2.0")
./alpha-pwa/backend/app/main.py:61:    return {"status": "ok", "service": "plt-alpha-backend", "version": "0.2.0"}
./docs/plans/2026-05-25-encrypted-plt-export.md:18:- Create: `alpha-pwa/frontend/scripts/check-plt-export-format.mjs`
./docs/plans/2026-05-25-encrypted-plt-export.md:19:- Modify: `alpha-pwa/frontend/package.json`
./docs/plans/2026-05-25-encrypted-plt-export.md:20:- Later create: `alpha-pwa/frontend/src/pltExport.ts`
./docs/plans/2026-05-25-encrypted-plt-export.md:36:cd alpha-pwa/frontend
./docs/plans/2026-05-25-encrypted-plt-export.md:61:- Create: `alpha-pwa/frontend/src/pltExport.ts`
./docs/plans/2026-05-25-encrypted-plt-export.md:62:- Test: `alpha-pwa/frontend/scripts/check-plt-export-format.mjs`
./docs/plans/2026-05-25-encrypted-plt-export.md:83:cd alpha-pwa/frontend
./docs/plans/2026-05-25-encrypted-plt-export.md:96:- Modify: `alpha-pwa/frontend/src/main.tsx`
./docs/plans/2026-05-25-encrypted-plt-export.md:97:- Modify/create static copy test if needed: `alpha-pwa/frontend/scripts/check-auth-onboarding.mjs` or new script
./docs/plans/2026-05-25-encrypted-plt-export.md:129:- Modify: `alpha-pwa/frontend/src/main.tsx`
./docs/plans/2026-05-25-encrypted-plt-export.md:130:- Modify: `alpha-pwa/frontend/src/styles.css`
./docs/plans/2026-05-25-encrypted-plt-export.md:131:- Modify: `alpha-pwa/frontend/scripts/check-layout-and-contrast-css.mjs`
./docs/plans/2026-05-25-encrypted-plt-export.md:176:- Modify: `alpha-pwa/frontend/src/main.tsx`
./docs/plans/2026-05-25-encrypted-plt-export.md:177:- Modify: `alpha-pwa/frontend/src/styles.css`
./docs/plans/2026-05-25-encrypted-plt-export.md:216:- Modify: `alpha-pwa/frontend/src/main.tsx`
./docs/plans/2026-05-25-encrypted-plt-export.md:217:- Use: `alpha-pwa/frontend/src/pltExport.ts`
./docs/plans/2026-05-25-encrypted-plt-export.md:218:- Test: `alpha-pwa/frontend/scripts/check-plt-export-format.mjs`
./docs/plans/2026-05-25-encrypted-plt-export.md:247:- Modify: `alpha-pwa/frontend/src/main.tsx`
./docs/plans/2026-05-25-encrypted-plt-export.md:248:- Use: `alpha-pwa/frontend/src/pltExport.ts`
./docs/plans/2026-05-25-encrypted-plt-export.md:279:cd alpha-pwa/frontend
./docs/plans/2026-05-25-encrypted-plt-export.md:288:cd alpha-pwa/backend
./docs/plans/2026-05-25-encrypted-plt-export.md:304:git add alpha-pwa/frontend/src/main.tsx alpha-pwa/frontend/src/styles.css alpha-pwa/frontend/src/pltExport.ts alpha-pwa/frontend/scripts/check-plt-export-format.mjs alpha-pwa/frontend/package.json docs/superpowers/specs/2026-05-25-encrypted-plt-export-design.md docs/plans/2026-05-25-encrypted-plt-export.md
./docs/superpowers/specs/2026-05-26-drafting-workspace-v1-design.md:381:- frontend reference: `exportBriefDocx` in `frontend/src/main.tsx` posts Markdown to `${API}/api/export-brief` and downloads the returned `.docx`;
./docs/superpowers/specs/2026-05-26-drafting-workspace-v1-design.md:382:- backend reference: `/api/export-brief` in `backend/app/main.py` uses `python-docx` (`Document`) to convert Markdown-ish text into a real Word document;
```

## Classification

### Path/config requiring update during final move

- `README.md` and `AGENTS.md` / `AGENT.md` workspace paths.
- `alpha-pwa/README.md` setup commands if the file is kept or moved.
- Frontend/backend local run commands mentioning `cd alpha-pwa/frontend` or `cd alpha-pwa/backend`.
- Backend tests that assume sibling `frontend` path.
- Vite/Capacitor/Netlify/Render/GitHub workflow paths if present.

### Product copy to keep

- `Pocket Legal Triage`
- `PLT`
- `.plt`
- `GiulIA`

### Generated artifacts to ignore/regenerate

- `alpha-pwa/frontend/dist/**`
- `alpha-pwa/frontend/android/app/build/**`
- `alpha-pwa/frontend/android/app/src/main/assets/public/**` unless intentionally regenerating Capacitor assets.
- Python `.venv/**`
- `.netlify/**`

### Legacy docs note

Older planning docs may mention `alpha-pwa` historically. During the final path rename, update runnable setup instructions and add a current-architecture note; do not rewrite every old product note just for churn.
