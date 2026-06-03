# Pocket Legal Triage
_Last updated: 2026-06-03_

> Mobile-first criminal-defense case triage for Italian lawyers.

Pocket Legal Triage (PLT) turns messy criminal-defense materials into a clean, source-linked case file: timeline, deadlines, contradictions, open questions, evidence map, and draft work products.

PLT is not an "AI lawyer." It is a case-control workspace. The lawyer stays in charge, verifies deadlines and citations, and treats generated output as draft material.

## Screenshots

| Case overview | Legal analysis | Document upload |
|:---:|:---:|:---:|
| ![Case detail view — Carta & Inchiostro design](assets/screenshots/Screenshot%20From%202026-05-27%2013-19-07.png) | ![Legal analysis tab with strategies and constitutional issues](assets/screenshots/Screenshot%20From%202026-05-27%2013-20-23.png) | ![Multi-file upload drawer with Documenti / Giurisprudenza tabs](assets/screenshots/Screenshot%20From%202026-05-27%2013-31-13.png) |
| Case header · GiulIA bar · stats | Strategies · constitutional risks | Upload drawer · URL import |

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
- Runs analysis as a resilient background job that survives navigating away, opening another case, locking the phone, or a refresh.
- Lets the lawyer add optional steering instructions before an analysis or draft (pre-flight modal), without overriding the no-inventing guardrails.
- Gates login behind a responsibility/privacy disclaimer + mandatory checkbox, with a first-run welcome panel and account controls (Profilo + quick logout).
- Protects the local-only case data with an optional app-lock: a 4-digit PIN (PBKDF2) plus optional WebAuthn biometric (offered only where a platform authenticator exists), required on cold start and after idle.
- Generates draft work products: memoria, ricorso Cassazione, eccezione, controesame, strategy memo, client note.
- Enforces a strict ban on invented Cassazione citations across all AI prompts; flags any slip-through as `DA VERIFICARE`.
- Supports privacy workflows through redaction, anonymization, local case storage, and export/import.
- Includes an Android Capacitor wrapper for APK testing.
- Carta & Inchiostro design system: bordeaux + carta palette, Newsreader + Satoshi typefaces, full dark/night mode.

## App Structure

```text
alpha-pwa/
├── backend/
│   ├── app/
│   │   ├── main.py             FastAPI routes (upload, analyze-text, analyze-jobs, chat, transcribe, fetch-url, export-brief, health)
│   │   ├── ai_service.py       Provider routing · Flash/Pro policy · prompt assembly (incl. user_instructions)
│   │   ├── models.py           Pydantic contracts (CaseAnalysis, AnalyzeRequest, AnalyzeJob*, ChatRequest, …)
│   │   ├── ocr_adapter.py      Mistral OCR boundary
│   │   └── demo_data.py        Demo case fixture
│   ├── tests/
│   │   ├── test_legal_schema.py
│   │   ├── test_pro_recommendation.py
│   │   ├── test_demo_case.py
│   │   ├── test_export_brief.py
│   │   ├── test_ocr_contract.py
│   │   ├── test_user_instructions.py
│   │   ├── test_analysis_jobs.py
│   │   └── test_frontend_copy.py
│   └── requirements.txt
├── frontend/
│   ├── public/
│   │   ├── favicon.svg         Bordeaux "P" mark (SVG master)
│   │   ├── favicon.ico         16 + 32 px ICO
│   │   ├── icon-192.png        PWA icon
│   │   ├── icon-512.png        PWA icon + maskable
│   │   └── manifest.json
│   ├── src/
│   │   ├── tokens.css          Carta & Inchiostro design tokens (load first)
│   │   ├── styles.css          Mobile-first component styles
│   │   ├── main.tsx            App shell · CaseListView · auth gate · LockGate · warm-up ping · routing
│   │   ├── config.ts           Shared API base URL
│   │   ├── supabaseClient.ts   Shared Supabase client (auth) + env-var guard
│   │   ├── db.ts               IndexedDB persistence
│   │   ├── pltExport.ts        Encrypted .plt export/import
│   │   ├── draftArtifacts.ts   Draft wrapper · Cassazione guardrail · export
│   │   ├── dateUtils.ts        Scadenze formatting helpers
│   │   ├── domain/
│   │   │   ├── types.ts        Shared case/analysis TypeScript types
│   │   │   ├── caseContext.ts  buildCaseContext() · buildUserContextMaterial()
│   │   │   ├── caseMerge.ts    AI merge logic
│   │   │   ├── redaction.ts    Redaction domain helpers
│   │   │   └── helpers.tsx     riskColor · riskLabel · riskIcon
│   │   ├── prompts/
│   │   │   ├── giulia.ts       SYSTEM_PROMPT_IT (GiulIA persona)
│   │   │   ├── documentDrafts.ts  DOC_PROMPTS · STRICT_PRECEDENT_BAN
│   │   │   └── redaction.ts    REDACT_DETECT_PROMPT · REDACT_APPLY_PROMPT
│   │   ├── screens/
│   │   │   └── CaseDetailView.tsx  Full case workspace (lazy-loaded chunk)
│   │   ├── components/
│   │   │   ├── GiuliaPromptBar.tsx
│   │   │   ├── ChatPanel.tsx       ChatDrawer · FloatingChatButton · FabRestoreButton
│   │   │   ├── AccountControls.tsx Profilo + quick logout + PIN/biometric management
│   │   │   ├── AiInstructionsModal.tsx  Pre-flight "istruzioni per GiulIA" steering modal
│   │   │   └── MultiFileUploadDrawer.tsx  (lazy-loaded chunk)
│   │   ├── analysis/
│   │   │   ├── analysisManager.ts        Background-analysis jobs (POST + poll + resume + merge)
│   │   │   └── AnalysisProgressBanner.tsx  Non-blocking progress banner + abort
│   │   ├── lock/
│   │   │   ├── appLock.ts          App-lock state + PBKDF2 PIN + WebAuthn biometric + idle/recovery
│   │   │   ├── LockGate.tsx        Gate: setup prompt → lock screen → app
│   │   │   ├── LockScreen.tsx      4-digit PIN pad + biometric unlock
│   │   │   └── LockSetup.tsx       First-run "proteggi con PIN" prompt + PinSetForm
│   │   ├── onboarding/
│   │   │   ├── OnboardingWizard.tsx  First-run spotlight tour (login → crea → carica → analizza)
│   │   │   └── wizardBus.ts          Pub/sub for advancement events + opt-out persistence
│   │   └── data/
│   │       ├── demo.json       Demo case fixture for local dev
│   │       └── mockApi.ts      Mock API for offline testing
│   ├── android/                Capacitor Android wrapper
│   ├── vite.config.ts          Build config with manualChunks (vendor-react, vendor-supabase)
│   └── package.json
└── docs/
    └── implementation-notes.md
```

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
npm run test:case-merge
npm run test:draft-workspace
npm run test:draft-workspace-ui
npm run test:auth-onboarding
npm run test:app-lock
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
