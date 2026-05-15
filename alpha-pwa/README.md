# ⚖️ Pocket Legal Triage — Alpha PWA

> **Italian criminal-defense case triage in a mobile-first dark-mode workspace.**

![Alpha](https://img.shields.io/badge/alpha-working-ff5a5f?style=for-the-badge)
![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-646cff?style=for-the-badge)
![Backend](https://img.shields.io/badge/backend-FastAPI-009688?style=for-the-badge)
![Models](https://img.shields.io/badge/models-DeepSeek%20%2F%20Claude-111827?style=for-the-badge)

This folder contains the working PLT alpha: a FastAPI backend plus a React/Vite PWA for turning messy criminal-defense case material into a structured, source-aware workspace.

The product is **not** an AI lawyer. It is a case triage cockpit for a lawyer who remains in control.

---

## 📸 Screenshots

<p align="center">
  <img src="../assets/screenshots/plt-demo_00.png" alt="Mobile fascicoli dashboard" width="220" />
  <img src="../assets/screenshots/plt-demo_03.png" alt="Mobile assistant overlay" width="220" />
</p>

<p align="center">
  <img src="../assets/screenshots/plt-demo_01.png" alt="Case detail timeline and procedural deadline" width="720" />
</p>

<p align="center">
  <img src="../assets/screenshots/plt-demo_02.png" alt="Legal assistant drafting shortcuts" width="420" />
</p>

---

## ✨ What is built

A working alpha with three fictional demo cases:

- **Caso Bianchi** — furto aggravato in concorso;
- **Caso Conti** — truffa online / e-commerce;
- **Caso Ferrari** — omicidio stradale aggravato.

Core app surfaces:

- 🏠 **Homepage** — case list with live stats: risk, deadlines, contradictions, materials.
- 📁 **Case detail** — 6-tab workspace: timeline, scadenze, fatti, analisi legale, domande aperte, memoria.
- ⚖️ **Legal analysis** — charge elements, defense strategies, constitutional issues, witness credibility, evidence balance.
- 🧑‍⚖️ **Aula Mode** — hearing-day overlay with keyboard/swipe navigation and live clock.
- 🤖 **AI chat** — floating case-aware assistant with streaming responses.
- ✍️ **Document drafting** — memoria difensiva, ricorso Cassazione, eccezione procedurale, controesame schema, analisi strategica.
- ✅ **Task tracking** — procedural deadline tasks persisted in localStorage.
- 📤 **Brief export** — clipboard copy plus Web Share API where supported.

---

## 🧰 Local setup

### Requirements

- Python 3.11+
- Node 18+ and npm
- A DeepSeek or Anthropic API key for live AI calls

### Backend

```bash
cd alpha-pwa/backend

# Create and activate a virtual environment
# Required on Debian/Ubuntu because of externally-managed-environment protections.
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Option A: export a key for this shell
export DEEPSEEK_API_KEY=sk-...        # uses deepseek-v4-flash / deepseek-v4-pro
# or
export ANTHROPIC_API_KEY=sk-ant-...   # uses claude-haiku-4-5 / claude-opus-4-7

# Start the API
uvicorn app.main:app --reload --port 8000
```

Optional `.env` approach:

```bash
# alpha-pwa/backend/.env — do not commit
DEEPSEEK_API_KEY=sk-...
```

Then load it before starting uvicorn:

```bash
set -a
source .env
set +a
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd alpha-pwa/frontend
npm install
npm run dev
```

Open **http://localhost:5173**. Vite proxies all `/api/*` requests to port `8000`.

---

## 🔀 API key routing

The backend auto-detects the provider from environment variables.

| Env var | Flash model | Pro model |
|---|---|---|
| `DEEPSEEK_API_KEY` | `deepseek-v4-flash` | `deepseek-v4-pro` |
| `ANTHROPIC_API_KEY` | `claude-haiku-4-5-20251001` | `claude-opus-4-7` |

If both are set, DeepSeek takes priority.

---

## ✅ Running tests

Backend:

```bash
cd alpha-pwa/backend
source .venv/bin/activate
python -m pytest tests/ -v
```

Frontend type-check + production build:

```bash
cd alpha-pwa/frontend
npm run build
```

---

## 🧱 Key files

```text
backend/
  app/main.py          FastAPI routes: /api/cases, /api/chat, /api/analyze-text, /api/upload
  app/models.py        Pydantic data model: CaseAnalysis, LegalAnalysis, ChatRequest, ...
  app/demo_data.py     Three fictional Italian demo cases
  app/ai_service.py    Provider routing, streaming chat, case analysis
  app/ocr_adapter.py   OCR boundary / provider adapter
  tests/               Backend contract and demo-case tests

frontend/
  src/main.tsx         React app: types, components, App
  src/styles.css       Mobile-first dark theme
  vite.config.ts       Vite config with /api proxy to port 8000
```

---

## 🗂️ Demo case inventory

| Case ID | Name | Charge | Risk |
|---|---|---|---|
| `demo-furto-aggravato-roma-2026` | Caso Bianchi | Art. 624/625/110 c.p. — furto aggravato in concorso | Medium |
| `demo-frode-online-napoli-2026` | Caso Conti | Art. 640 c.p. — truffa online | High |
| `demo-omicidio-stradale-milano-2026` | Caso Ferrari | Art. 589-bis c.p. — omicidio stradale aggravato | High |

---

## 🧠 AI chat behavior

The assistant is prompted as an Italian criminal-defense support system with knowledge of:

- Codice Penale and relevant case law;
- Codice di Procedura Penale;
- Leggi speciali: Codice della Strada, T.U. Stupefacenti, d.lgs. 231/2001;
- Corte di Cassazione Penale jurisprudence;
- Corte EDU fair-trial principles.

When a case is open, the full dossier — charges, strategies, witnesses, contradictions, evidence balance, deadlines — is injected into the chat context.

---

## 🔍 OCR note

File upload currently supports the alpha contract and text extraction path. Dedicated OCR remains behind an adapter so the provider can be swapped without rewriting the product workflow.

The rule stays the same:

> Source or shut up. Every extracted claim needs a quote, source reference, and confidence score before it should be trusted.
