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
| `PLT_FLASH_MAX_TOKENS` | Flash response token budget |
| `PLT_PRO_MAX_TOKENS` | Pro response token budget |
| `PLT_FLASH_MAX_ANALYSIS_CHARS` | Flash input text budget, default `60000` |
| `PLT_PRO_MAX_ANALYSIS_CHARS` | Pro input text budget, default `300000` |

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
  app/main.py             FastAPI routes (upload, analyze, chat, transcribe, fetch-url)
  app/ai_service.py       Provider routing · Flash/Pro policy · prompt assembly
  app/models.py           Pydantic contracts (CaseAnalysis, ChatRequest, …)
  app/ocr_adapter.py      Mistral OCR boundary
  app/demo_data.py        Demo case fixture
  tests/                  Backend contract tests (pytest)

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
    main.tsx              App shell · CaseListView · routing
    config.ts             Shared API base URL
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
      MultiFileUploadDrawer.tsx  (lazy-loaded chunk)

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
