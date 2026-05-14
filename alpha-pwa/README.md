# Pocket Legal Triage Alpha PWA

Thin working alpha for validating Pocket Legal Triage with Italian criminal-defense lawyers.

## Current scope

This is **Milestone 1 / early Milestone 2 scaffolding**:

- FastAPI backend exposes an Italian fictional demo case at `/api/demo-case`.
- React/Vite mobile-first frontend renders:
  - timeline;
  - people and evidence;
  - open questions;
  - missing documents;
  - contradictions;
  - source-linked brief;
  - DeepSeek Flash-first usage estimate.
- Sample data is Italian and criminal-defense oriented.

No real DeepSeek call is wired yet. The backend currently serves structured fixture data shaped like the future DeepSeek extraction output.

## Why Italian first

Deckard explicitly requested Italian text. The validation target is initially Italian criminal defense, and DeepSeek V4 Pro appears promising for Italian/civil-law reasoning.

## Run backend

From `/home/deckard/plt/alpha-pwa`:

```bash
PYTHONPATH=backend backend/.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

If dependencies need reinstalling:

```bash
backend/.venv/bin/python -m pip install -r backend/requirements.txt
```

## Run frontend

From `/home/deckard/plt/alpha-pwa/frontend`:

```bash
npm run dev
```

Then open:

```text
http://127.0.0.1:5173
```

## Test / verify

Backend tests:

```bash
cd /home/deckard/plt/alpha-pwa
PYTHONPATH=backend backend/.venv/bin/python -m pytest backend/tests -q
```

Frontend build:

```bash
cd /home/deckard/plt/alpha-pwa/frontend
npm run build
```

## Files

```text
backend/app/main.py        FastAPI app
backend/app/models.py      Pydantic CaseAnalysis contract
backend/app/demo_data.py   Italian fictional demo case fixture
backend/tests/             backend tests
frontend/src/main.tsx      React app
frontend/src/styles.css    mobile-first styling
sample-data/               raw fictional Italian demo materials
```

## DeepSeek key

The backend expects a local private file:

```text
backend/.env
```

Required variables:

```text
DEEPSEEK_API_KEY=[REDACTED]
DEEPSEEK_DEFAULT_MODEL=deepseek-v4-flash
DEEPSEEK_PRO_MODEL=deepseek-v4-pro
```

Do not commit this file. It is ignored by `.gitignore`.

## OCR strategy note

Do **not** assume V4 Flash/Pro should be the main OCR engine.

Current direction:

- V4 Flash: extraction, classification, summarization, structured case triage.
- V4 Pro: escalation / legal reasoning / hard contradictions.
- DeepSeek-OCR 3B or another dedicated OCR model: primary OCR path if validation confirms quality and deployment is practical.

This keeps OCR as a replaceable adapter rather than baking it into the LLM route.

## Next implementation step

Wire a real `/api/analyze-text` endpoint:

1. Accept uploaded/pasted Italian text.
2. Call DeepSeek V4 Flash.
3. Ask for the same `CaseAnalysis` JSON shape.
4. Render returned analysis in the existing UI.

After that:

- add PDF/plain-text extraction;
- add dedicated OCR adapter, likely DeepSeek-OCR 3B/local or hosted-free workflow after Deckard sends the V4 notes;
- add optional `Deep Analysis` route using DeepSeek V4 Pro.
