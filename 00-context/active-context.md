# Active Context

## Current state

Working alpha PWA at `alpha-pwa/`. All core features built and tested.

## What's been built

### Backend (`alpha-pwa/backend/`)

- FastAPI app with routes: `/api/cases`, `/api/cases/{id}`, `/api/demo-case`, `/api/analyze-text`, `/api/chat`, `/api/upload`
- Pydantic data model: `CaseAnalysis`, `LegalAnalysis`, `CaseSummary`, `ChatRequest`, full nested legal models
- Three Italian demo cases: Caso Bianchi (furto aggravato, Roma), Caso Conti (frode online, Napoli), Caso Ferrari (omicidio stradale, Milano)
- Provider routing: `DEEPSEEK_API_KEY` → DeepSeek via openai SDK; `ANTHROPIC_API_KEY` → Anthropic SDK
- Streaming SSE chat via `/api/chat` — system prompt embeds full Italian criminal law knowledge
- 11 passing backend tests

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
npm install && npm run dev
# → http://localhost:5173
```

## Active branch

`claude/explore-lawyer-app-demo-lSVyc` on `chiantera/plt`

## Immediate next steps (candidates)

- PWA manifest (installable, offline-capable)
- Chat history persistence (localStorage)
- Model switcher in chat UI (flash ↔ pro with cost indicator)
- Real OCR integration (replace upload stub)
- Lawyer interviews / validation

## Key product decisions

- DeepSeek V4 Flash is the default for all AI tasks — ~100x cheaper than Claude for dev and testing
- DeepSeek V4 Pro for deep legal reasoning / document drafting when quality matters
- Anthropic supported as fallback, same codebase, auto-detected from env
- Italian criminal law is primary jurisdiction; the AI system prompt cites c.p., c.p.p., Cassazione
- Source-linking is non-negotiable — every claim links to a document quote with confidence score
- Mobile-first, dark theme, glass-morphism PWA aesthetic
