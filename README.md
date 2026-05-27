# Pocket Legal Triage
_Last updated: 2026-05-27_

> Mobile-first criminal-defense case triage for Italian lawyers.

Pocket Legal Triage (PLT) turns messy criminal-defense materials into a clean, source-linked case file: timeline, deadlines, contradictions, open questions, evidence map, and draft work products.

PLT is not an "AI lawyer." It is a case-control workspace. The lawyer stays in charge, verifies deadlines and citations, and treats generated output as draft material.

## Current State

The working alpha lives in [`alpha-pwa/`](./alpha-pwa/).

| Layer | Stack | Current deployment |
|---|---|---|
| Frontend | React + Vite + Capacitor | Netlify |
| Backend | FastAPI | Render |
| Persistence | IndexedDB locally, Supabase auth for deployed app | Alpha |
| AI routing | DeepSeek primary, Anthropic fallback | Env-driven |

The app is live for limited colleague testing. See [`CURRENT-TASK.md`](./CURRENT-TASK.md) for the latest handoff, known risks, and verification notes.

## What PLT Does

- Creates and imports encrypted `.plt` case files.
- Uploads PDFs, Office files, text, images, archives, and audio into a fascicolo.
- Extracts case structure: timeline, people, evidence, contradictions, missing documents, open questions, and procedural deadlines.
- Keeps every factual claim tied to source references, quotes, and confidence scores.
- Marks deadlines as candidate/needs-review/confirmed instead of treating AI-calculated dates as authoritative.
- Provides a case-aware GiulIA assistant for analysis, drafting, scadenze, and app guidance.
- Generates draft work products: memoria, ricorso Cassazione, eccezione, controesame, strategy memo, client note.
- Enforces a strict ban on invented Cassazione citations across all AI prompts; flags any slip-through as `DA VERIFICARE`.
- Supports privacy workflows through redaction, anonymization, local case storage, and export/import.
- Includes an Android Capacitor wrapper for APK testing.

## Quick Start

Backend:

```bash
cd alpha-pwa/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

export DEEPSEEK_API_KEY=sk-...
# or: export ANTHROPIC_API_KEY=sk-ant-...

uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd alpha-pwa/frontend
npm install
VITE_BYPASS_AUTH=true npm run dev
```

Open the URL printed by Vite. The auth bypass is localhost-only; deployed builds use Supabase auth.

## Verification

Useful checks from this repo:

```bash
cd alpha-pwa/frontend
npm run build
npm run test:plt-export
npm run test:local-case-scope
npm run test:draft-workspace
npm run test:draft-workspace-ui
```

Backend checks:

```bash
cd alpha-pwa/backend
source .venv/bin/activate
python -m pytest tests/ -q
```

If a backend pytest run hangs in the local harness after passing tests, use focused test files or `timeout` and record the behavior in `CURRENT-TASK.md`.

## Model Policy

| Workload | Default | Premium / fallback |
|---|---|---|
| Bulk extraction, ordinary chat, ordinary drafting | DeepSeek V4 Flash | Claude Haiku fallback |
| Deep legal reasoning and high-stakes strategy | DeepSeek V4 Pro, only after explicit confirmation | Claude Opus fallback |
| Native PDF extraction | pypdf | Provider-swappable adapter |
| Scanned PDF / image OCR | OCR adapter | Provider-swappable adapter |

Heavy processing must remain transparent to the lawyer. Candidate Pro analysis is recommended and gated before use.

## Workspace Map

```text
alpha-pwa/     Working alpha PWA: FastAPI backend, React/Vite frontend, Android wrapper
00-context/    Handoff notes and session context
01-product/    Specs, UX, feature map
02-research/   Market, model, OCR, legal-tech research
03-business/   Pricing, unit economics, GTM
04-technical/  Architecture, data model, provider routing
05-validation/ Interviews and experiments
06-brand/      Positioning and copy
07-prompts/    Prompts, prompt map, eval notes
```

## Non-Negotiables

- Do not frame PLT as an "AI lawyer."
- Keep the lawyer in control; outputs are drafts, not decisions.
- Source-link factual claims to document quotes with confidence scores.
- Keep candidate deadlines visibly unconfirmed until verified.
- Do not invent facts, deadlines, statutes, or Cassazione citations.
- Validate with real lawyers before building too much.

## Product Positioning

Use:

> Mobile-first criminal-defense case triage.

Avoid:

> AI lawyer.

Wrong product, wrong liability.
