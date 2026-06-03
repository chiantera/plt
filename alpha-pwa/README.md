# Pocket Legal Triage — Alpha PWA
_Last updated: 2026-05-27_

Pocket Legal Triage (PLT) is the working alpha app for mobile-first Italian criminal-defense case triage. It combines a FastAPI backend, a React/Vite frontend, local-first case storage, Supabase auth for deployed builds, and a Capacitor Android wrapper.

It is not an AI lawyer. It is a lawyer-controlled workspace for organizing materials, surfacing issues, and producing draft work products that must be verified before use.

## Current Deployment

| Layer | Service |
|---|---|
| Frontend | Netlify |
| Backend | Render |
| Auth | Supabase |
| Android test build | Capacitor APK from `frontend/android/` |

Pushes to `main` trigger the Netlify frontend deploy. Backend deploys are handled separately on Render.

## What Is Built

- Mobile-first fascicoli dashboard with risk, deadlines, contradictions, and material counts.
- Case workspace with timeline, scadenze, facts, legal analysis, open questions, and draft brief.
- Upload and extraction path for documents, images, archives, and audio.
- OCR boundary for native PDFs and scanned/image inputs.
- Inline editing across case facts, deadlines, legal analysis, witnesses, and strategies.
- AI merge flow that updates analyzed case state without intentionally overwriting local edits.
- Resilient background analysis: analyses run as backend jobs (`POST/GET /api/analyze-jobs`) driven by `frontend/src/analysis/analysisManager.ts`, so they survive navigating away, opening another case, locking the phone, or a refresh; the case list shows an "Analisi in corso…" pill and refreshes on completion.
- Optional pre-flight "istruzioni per GiulIA" steering before Analizza / Pro / Ri-analizza / Crea bozza (`AnalyzeRequest.user_instructions`); never a source of facts, deadlines, or precedents.
- App-lock: a 4-digit PIN (+ optional WebAuthn biometric unlock) gating the app on cold start and after idle/background, protecting the local-only case data on a lost/shared device. PIN stored as a PBKDF2 hash only; recovery via re-login (the Supabase password stays the root). Managed from Profilo.
- GiulIA assistant with case context and quick actions.
- Draft workspace for memoria, ricorso Cassazione, eccezione, controesame, strategy memo, and client note.
- Strict ban on invented Cassazione citations across all AI prompts (DIVIETO ASSOLUTO pattern); `DA VERIFICARE` post-processing as safety net.
- Redaction and anonymization workflows for sharing.
- Encrypted `.plt` export/import for sharing fascicoli.
- Pro analysis recommendation flow for heavier legal reasoning, gated by user confirmation.
- Carta & Inchiostro design system: bordeaux + carta palette, Newsreader + Satoshi typefaces, full dark/night mode.

## Local Setup

### Backend

```bash
cd alpha-pwa/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

export DEEPSEEK_API_KEY=sk-...
# or: export ANTHROPIC_API_KEY=sk-ant-...

uvicorn app.main:app --reload --port 8000
```

The backend reads provider settings from the environment:

| Env var | Purpose |
|---|---|
| `DEEPSEEK_API_KEY` | Primary provider key |
| `DEEPSEEK_DEFAULT_MODEL` | Ordinary work, defaults to `deepseek-v4-flash` |
| `DEEPSEEK_PRO_MODEL` | Confirmed Pro legal reasoning route, defaults to `deepseek-v4-pro` |
| `ANTHROPIC_API_KEY` | Fallback provider key |
| `PLT_MAX_UPLOAD_BYTES` | Upload limit, default `52428800` (50 MB) |
| `PLT_FLASH_MAX_TOKENS` | Flash generated-output token budget, default `128000` |
| `PLT_PRO_MAX_TOKENS` | Pro generated-output token budget, default `256000` (doubled; Pro uses ~80-100K reasoning tokens before producing JSON output) |
| `PLT_CHAT_MAX_TOKENS` | Chat / streaming token budget, default `32768` |
| `PLT_FLASH_MAX_ANALYSIS_CHARS` | Flash input text budget, default `1000000` |
| `PLT_PRO_MAX_ANALYSIS_CHARS` | Pro input text budget, default `1000000` |

### Frontend

```bash
cd alpha-pwa/frontend
npm install
VITE_BYPASS_AUTH=true npm run dev
```

The Vite dev server proxies `/api/*` to `http://localhost:8000`. If port `5173` is busy:

```bash
npm run dev -- --port 5178
```

Useful frontend env vars:

| Env var | Purpose |
|---|---|
| `VITE_API_URL` | Backend URL for deployed/mobile builds |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase public anon key |
| `VITE_BYPASS_AUTH` | Localhost-only auth bypass |

Do not commit real `.env` files once the app moves beyond closed alpha testing.

**Full env-var reference** (Render backend, Netlify frontend, Supabase setup): [`docs/environment.md`](docs/environment.md).

## Android APK

The Android wrapper lives under `frontend/android/`. For a debug APK:

```bash
cd alpha-pwa/frontend
npm run build
npx cap sync android
cd android
ANDROID_HOME=/home/deckard/Android/Sdk ANDROID_SDK_ROOT=/home/deckard/Android/Sdk ./gradlew assembleDebug
```

Mobile builds must use a reachable backend URL through `VITE_API_URL`; `localhost` points at the phone, not the development machine.

## Verification

Frontend:

```bash
cd alpha-pwa/frontend
npm run build
npm run test:auth-onboarding
npm run test:date-formatters
npm run test:question-layout
npm run test:plt-export
npm run test:local-case-scope
npm run test:case-merge
npm run test:draft-workspace
npm run test:draft-workspace-ui
```

Backend:

```bash
cd alpha-pwa/backend
source .venv/bin/activate
python -m pytest tests/ -q
```

If the full backend suite hangs in this local harness after printing successful dots, run focused files with `timeout` and document the result in the handoff.

## Key Files

```text
backend/
  app/main.py             FastAPI routes (upload, analyze-text, analyze-jobs, chat, transcribe, fetch-url, export-brief, health)
  app/ai_service.py       Provider routing · Flash/Pro policy · prompt assembly (incl. user_instructions)
  app/models.py           Pydantic contracts (CaseAnalysis, AnalyzeRequest, AnalyzeJob*, ChatRequest, …)
  app/ocr_adapter.py      Mistral OCR boundary
  app/demo_data.py        Demo case fixture
  tests/                  Backend contract tests (pytest) — incl. test_user_instructions, test_analysis_jobs

frontend/
  public/
    favicon.svg           Bordeaux "P" mark (SVG master)
    favicon.ico           16 + 32 px ICO
    icon-192.png          PWA icon
    icon-512.png          PWA icon + maskable
    manifest.json

  src/
    tokens.css            Carta & Inchiostro design tokens (load before styles.css)
    styles.css            Mobile-first component styles
    main.tsx              App shell · CaseListView · auth gate · LockGate · warm-up ping · routing
    config.ts             Shared API base URL
    supabaseClient.ts     Shared Supabase client (auth) + env-var guard
    db.ts                 IndexedDB persistence
    pltExport.ts          Encrypted .plt export/import
    draftArtifacts.ts     Draft wrapper · Cassazione guardrail · export
    dateUtils.ts          Scadenze formatting helpers

    domain/
      types.ts            Shared case/analysis TypeScript types
      caseContext.ts      buildCaseContext() · buildUserContextMaterial()
      caseMerge.ts        AI merge logic
      redaction.ts        Redaction domain helpers
      helpers.tsx         riskColor · riskLabel · riskIcon

    prompts/
      giulia.ts           SYSTEM_PROMPT_IT (GiulIA persona)
      documentDrafts.ts   DOC_PROMPTS · STRICT_PRECEDENT_BAN
      redaction.ts        REDACT_DETECT_PROMPT · REDACT_APPLY_PROMPT

    screens/
      CaseDetailView.tsx  Full case workspace (lazy-loaded chunk)

    components/
      GiuliaPromptBar.tsx
      ChatPanel.tsx       ChatDrawer · FloatingChatButton · FabRestoreButton
      AccountControls.tsx Profilo + quick logout + PIN/biometric management
      AiInstructionsModal.tsx  Pre-flight "istruzioni per GiulIA" steering modal
      MultiFileUploadDrawer.tsx  (lazy-loaded chunk)

    analysis/
      analysisManager.ts        App-level background-analysis jobs (POST + poll + resume + merge)
      AnalysisProgressBanner.tsx  Non-blocking progress banner + abort

    lock/
      appLock.ts          App-lock state + PBKDF2 PIN + WebAuthn biometric + idle/recovery
      LockGate.tsx        Gate: setup prompt → lock screen → app; cold-start + idle triggers
      LockScreen.tsx      4-digit PIN pad + biometric unlock
      LockSetup.tsx       First-run "proteggi con PIN" prompt + reusable PinSetForm

    onboarding/
      OnboardingWizard.tsx  First-run spotlight tour (login → crea → carica → analizza)
      wizardBus.ts          Pub/sub for advancement events + opt-out persistence

    data/
      demo.json           Demo case fixture for local dev
      mockApi.ts          Mock API for offline testing

  vite.config.ts          manualChunks for vendor-react + vendor-supabase
  android/                Capacitor Android wrapper
```

## Product Rules

- Outputs are drafts and checklists, not decisions.
- Every factual claim needs source references with quotes and confidence.
- Deadline candidates remain visibly unconfirmed until a lawyer verifies them.
- Cassazione citations must be verified or marked `DA VERIFICARE`.
- Keep provider/model plumbing out of the lawyer-facing UI except where explicit Pro confirmation is needed.
