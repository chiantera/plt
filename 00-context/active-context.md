# Active Context
_Last updated: 2026-05-20 02:49_

## Current state

Working alpha PWA at `alpha-pwa/`. Core product surfaces exist, but do **not** call the app production-ready yet: the latest checkpoint found missing repeatable lint/e2e scripts, backend tests require a venv with `pytest`, and browser QA still shows a generic JS exception that needs root-cause investigation.

Latest handoffs:

- `00-context/session-handoff-2026-05-19.md`
- `00-context/session-handoff-2026-05-20-gemini-compare.md`

## What's been built

### Backend (`alpha-pwa/backend/`)

- FastAPI app with routes: `/api/cases`, `/api/cases/{id}`, `/api/demo-case`, `/api/analyze-text`, `/api/chat`, `/api/upload`
- Pydantic data model: `CaseAnalysis`, `LegalAnalysis`, `CaseSummary`, `ChatRequest`, full nested legal models
- Three Italian demo cases: Caso Bianchi (furto aggravato, Roma), Caso Conti (frode online, Napoli), Caso Ferrari (omicidio stradale, Milano)
- Provider routing: `DEEPSEEK_API_KEY` → DeepSeek via openai SDK; `ANTHROPIC_API_KEY` → Anthropic SDK
- Streaming SSE chat via `/api/chat` — system prompt embeds Italian criminal-law triage context
- Backend tests exist under `alpha-pwa/backend/tests/`; verified command: `cd alpha-pwa/backend && ./.venv/bin/python -m pytest -q`.
- Upload endpoint now streams to a temp file, enforces `PLT_MAX_UPLOAD_BYTES`/50 MiB default cap, and offloads extraction to a threadpool.
- Legal schema includes `ProceduralDeadline.feriale_applied` and `DefenseStrategy.target_charge_id` for charge-specific strategy/deadline precision.

### Frontend (`alpha-pwa/frontend/`)

- Homepage with hero, live stats bar (risk / deadlines / contradictions), sticky search+CTA bar
- Case detail: 6-tab view (timeline, scadenze, fatti, analisi legale, domande aperte, memoria)
- Legal analysis tab: charge elements, defense strategies, constitutional issues, witness credibility, evidence balance, AI document drafting section
- Aula Mode: full-screen 5-slide court overlay with keyboard/swipe/live clock
- Floating AI chat: streaming responses, case context auto-injected, quick action chips
- Document drafting from chat: memoria difensiva, ricorso Cassazione, eccezione procedurale, controesame, analisi strategica
- Task checkboxes with localStorage persistence, brief export (clipboard + Web Share API)

## Setup (local)

```bash
# Backend
cd alpha-pwa/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DEEPSEEK_API_KEY=sk-...
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd alpha-pwa/frontend
npm install
npm run dev
# → Vite default is http://localhost:5173, but verify the port.
# If 5173 is occupied by another app, use e.g. npm run dev -- --port 5178
```

## Active branch

`main` on `chiantera/plt`

## Immediate next steps (candidates)

- Reproduce and fix any remaining generic browser JS exception if it appears outside the verified login → dashboard flow
- Expand repeatable frontend tests beyond the new `test:auth-onboarding` guard; add Playwright dashboard/case/chat smoke tests
- Backend tests run cleanly now (`15 passed`), but still need broader frontend/e2e coverage and final release gate.
- Resolve local port hygiene: stale non-PLT app was found on 5173 during QA
- PWA manifest / installability / offline basics
- Model switcher in chat UI (Flash ↔ Pro with cost indicator)
- Real OCR integration hardening and validation
- Lawyer interviews / validation

## Key product decisions

- DeepSeek V4 Flash is the default for all AI tasks — ~100x cheaper than Claude for dev and testing
- DeepSeek V4 Pro for deep legal reasoning / document drafting when quality matters
- Anthropic supported as fallback, same codebase, auto-detected from env
- Italian criminal law is primary jurisdiction; the AI system prompt cites c.p., c.p.p., Cassazione
- Source-linking is non-negotiable — every claim links to a document quote with confidence score
- Mobile-first, dark theme, glass-morphism PWA aesthetic
