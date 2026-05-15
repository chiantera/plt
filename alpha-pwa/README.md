# Pocket Legal Triage — Alpha PWA

Mobile-first criminal-defense case triage. Italian market, dark theme, AI-powered.

## What's built

A working alpha with three fictional demo cases (furto aggravato, frode online, omicidio stradale) and full AI integration:

- **Homepage** — case list with live stats (risk count, upcoming deadlines, contradictions)
- **Case detail** — 6-tab view: timeline, scadenze, fatti, analisi legale, domande aperte, memoria
- **Legal analysis tab** — per-charge element breakdown, ranked defense strategies, constitutional issues, witness credibility scores, evidence balance
- **Aula Mode** — full-screen court-day overlay (5 slides, keyboard + swipe navigation, live clock)
- **AI chat** — floating chat button, streaming responses, case context auto-injected
- **Document drafting** — memoria difensiva, ricorso Cassazione, eccezione procedurale, controesame schema, analisi strategica — all pre-loaded with actual case facts
- **Task tracking** — deadline tasks with checkbox completion persisted in localStorage
- **Brief export** — clipboard copy + Web Share API

---

## Local setup

### Requirements

- Python 3.11+
- Node 18+ and npm
- A DeepSeek or Anthropic API key

### Backend

```bash
cd plt/alpha-pwa/backend

# Create and activate a virtual environment
# (required on Debian/Ubuntu — externally-managed-environment)
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set your API key — DeepSeek is ~100x cheaper for dev
export DEEPSEEK_API_KEY=sk-...        # uses deepseek-v4-flash / deepseek-v4-pro
# OR
export ANTHROPIC_API_KEY=sk-ant-...   # uses claude-haiku-4-5 / claude-opus-4-7

# Start the server
uvicorn app.main:app --reload --port 8000
```

Each new terminal session you need to re-activate the venv:

```bash
source plt/alpha-pwa/backend/.venv/bin/activate
```

### Frontend

```bash
cd plt/alpha-pwa/frontend
npm install      # first time only
npm run dev
```

Open **http://localhost:5173** — Vite proxies all `/api/*` requests to port 8000 automatically.

---

## API key routing

The backend auto-detects which provider to use based on which env var is set:

| Env var | Flash model | Pro model |
|---|---|---|
| `DEEPSEEK_API_KEY` | `deepseek-v4-flash` | `deepseek-v4-pro` |
| `ANTHROPIC_API_KEY` | `claude-haiku-4-5-20251001` | `claude-opus-4-7` |

If both are set, DeepSeek takes priority.

---

## Running tests

Backend (activate venv first):

```bash
cd plt/alpha-pwa/backend
source .venv/bin/activate
python -m pytest tests/ -v
```

Frontend type-check + build:

```bash
cd plt/alpha-pwa/frontend
npm run build
```

---

## Key files

```
backend/
  app/main.py          FastAPI routes (/api/cases, /api/chat, /api/analyze-text, /api/upload)
  app/models.py        Pydantic data model (CaseAnalysis, LegalAnalysis, ChatRequest, ...)
  app/demo_data.py     Three fictional Italian demo cases
  app/ai_service.py    Provider routing (DeepSeek/Anthropic), streaming chat, case analysis
  tests/               Backend test suite (11 tests)

frontend/
  src/main.tsx         Entire React app (~1600 lines — types, components, App)
  src/styles.css       Mobile-first dark theme CSS (~800 lines)
  vite.config.ts       Vite config with /api proxy to port 8000
```

---

## Demo cases

| Case ID | Name | Charge | Risk |
|---|---|---|---|
| `demo-furto-aggravato-roma-2026` | Caso Bianchi | Art. 624/625/110 c.p. — furto aggravato in concorso | Medium |
| `demo-frode-online-napoli-2026` | Caso Conti | Art. 640 c.p. — truffa online | High |
| `demo-omicidio-stradale-milano-2026` | Caso Ferrari | Art. 589-bis c.p. — omicidio stradale aggravato | High |

---

## AI chat system prompt

The chat assistant knows:
- Codice Penale (r.d. 2441/1930) and case law
- Codice di Procedura Penale (d.P.R. 447/1988)
- Leggi speciali: Codice della Strada, T.U. Stupefacenti, d.lgs. 231/2001
- Corte di Cassazione Penale jurisprudence (all sections)
- Corte EDU fair trial principles

When a case is open, the full dossier (charges, strategies, witnesses, contradictions, evidence balance) is injected into the system prompt automatically.

---

## OCR note

File upload is currently a stub — `.txt` files are extracted, everything else returns a message asking the user to paste text manually. Dedicated OCR is the next infrastructure milestone.

---

## Environment file (optional)

You can store the API key in a `.env` file in `backend/` instead of exporting it each time:

```
# backend/.env  — do not commit
DEEPSEEK_API_KEY=sk-...
```

Then load it before starting uvicorn:

```bash
export $(grep -v '^#' .env | xargs)
uvicorn app.main:app --reload --port 8000
```

The `.env` file is in `.gitignore`.
