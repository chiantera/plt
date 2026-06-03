# CLAUDE.md — Pocket Legal Triage

> Mirrors `AGENT.md` / `AGENTS.md`. Claude Code auto-loads this file. **After ANY edit to this file, re-clone it verbatim to `AGENT.md` and `AGENTS.md` in the same commit — all three must stay byte-identical.**

You are working in `/home/deckard/projects/plt`, the Pocket Legal Triage (PLT) workspace.

Repo: `chiantera/plt` (`origin https://github.com/chiantera/plt.git`).  
Working convention: commit coherent slices directly to `main` and push, unless Deckard explicitly asks for a branch or worktree.

Remote workflow: when Deckard works remotely he may ask you to send screenshots or code snippets to his Gmail via the Google Workspace integration (local `gws` skill pack, gitignored).

---

## Mission

Design, build, and validate a mobile-first legal triage product for Italian criminal-defense lawyers.

Core thesis:
> Turn legal chaos into a clean case file.

---

## Read first at the start of every PLT thread

1. `CURRENT-TASK.md` — latest handoff, branch/head, verification, next steps, and active backlog. **This is the first place to check for Deckard's current priorities.**
2. `07-prompts/2026-05-26-plt-ai-prompts-map.md` — living prompt inventory; update it whenever prompt behavior, model routing, Flash/Pro policy, or legal copy changes.
3. `07-prompts/extraction-prompts.md` — historical rough sketches only; not source of truth.
4. `04-technical/` and `01-product/` for architecture and product decisions when relevant.
5. `alpha-pwa/backend/app/ai_service.py`, `alpha-pwa/frontend/src/prompts/`, `alpha-pwa/frontend/src/draftArtifacts.ts`, and `alpha-pwa/frontend/src/main.tsx` before changing any AI behavior.

---

## Current app state

A working alpha PWA lives at `alpha-pwa/`:

| Layer | Stack | Deployment |
|---|---|---|
| Backend | FastAPI | Render — `https://plt-backend.onrender.com` |
| Frontend | React + Vite | Netlify — `https://pocket-legal-triage.netlify.app` |
| Auth | Supabase | Deployed builds only |
| Android wrapper | Capacitor | `alpha-pwa/frontend/android/` |
| AI primary | DeepSeek (OpenAI-compatible) | `DEEPSEEK_API_KEY` |
| AI fallback | Anthropic | `ANTHROPIC_API_KEY` |

Public health checks:
- Frontend: `https://pocket-legal-triage.netlify.app`
- Backend: `https://plt-backend.onrender.com/api/health`
- Backend docs: `https://plt-backend.onrender.com/docs`

Default product language and legal wedge: **Italian criminal defense**.

---

## Workspace structure

```text
alpha-pwa/          Working alpha PWA (backend + frontend + android wrapper)
00-context/         Handoff and session notes
01-product/         Specs, UX, feature map
02-research/        Market, model, OCR, legal-tech research
03-business/        Pricing, unit economics, GTM
04-technical/       Architecture, data model, provider routing
05-validation/      Interviews and experiments
06-brand/           Positioning and copy
07-prompts/         Prompts, prompt map, eval notes
CURRENT-TASK.md     Current handoff and next steps
SOUL.md             Product philosophy and smell tests
```

### Key source files

```text
alpha-pwa/backend/
  app/main.py           FastAPI routes (upload, analyze, chat, transcribe)
  app/ai_service.py     Provider routing, Flash/Pro prompt policy, analysis/chat calls
  app/models.py         Pydantic contracts: CaseAnalysis, ProRecommendation, ChatRequest…
  app/ocr_adapter.py    Mistral OCR boundary
  tests/                Backend contract tests (pytest)

alpha-pwa/frontend/src/
  main.tsx                   Main React shell and screen composition
  domain/types.ts            Shared case/analysis types
  domain/caseContext.ts      buildCaseContext() and buildUserContextMaterial()
  domain/caseMerge.ts        AI merge logic
  domain/redaction.ts        Redaction domain helpers
  prompts/giulia.ts          SYSTEM_PROMPT_IT (frontend GiulIA persona)
  prompts/documentDrafts.ts  DOC_PROMPTS: memoria, cassazione, eccezione, crossExam, strategy, clienteNote
  prompts/redaction.ts       REDACT_DETECT_PROMPT / REDACT_APPLY_PROMPT
  draftArtifacts.ts          Draft artifact wrapper, DRAFT_PRECEDENT_GUARDRAIL, buildDraftPrompt()
  db.ts / pltExport.ts       IndexedDB persistence and encrypted .plt export/import
  styles.css                 Mobile-first dark UI
```

---

## Current priority themes

- **Improve in-app AI prompts** and keep the prompt map up to date.
- **Stop GiulIA from inventing Cassazione precedents.** `DA VERIFICARE` is an interim warning. Until verified legal retrieval (RAG / user-supplied judgments) exists, treat model-generated Cassazione citations as fabricated. See `CURRENT-TASK.md` for the current mitigation status and product options.
- **Flash / Pro split — preserve it:**
  - Flash (`mode: "flash"`) = extraction, structure, concise fields, no deep strategy by default.
  - Pro (`mode: "pro"`) = deep reasoning over contradictions, procedural risks, defensive hypotheses, missing evidence, next actions.
- **Pro is recommended, not silently run:** show `Approfondimento Pro con GiulIA`; require explicit confirmation click before sending `mode: "pro"`; `auto_charge: false`.
- **FAB usability:** fix the floating action button hide/dismiss interaction (see `CURRENT-TASK.md`).
- **Frontend restructuring:** keep extracting from the giant `main.tsx` into domain types, utilities, prompt modules, UI primitives, screens/features. Do this before any `alpha-pwa/` folder rename.
- **Bundle splitting:** address Vite's >500 KB chunk warning with dynamic imports or Rollup `manualChunks`.

---

## Model routing

| Workload | Model | Trigger |
|---|---|---|
| Extraction, ordinary chat, JSON, summaries, anonymization | DeepSeek Flash (`deepseek-chat`) / Claude Haiku fallback | `mode: "flash"` (default) |
| Deep legal reasoning, contradictions, appeal prep, hard synthesis | DeepSeek Pro (`deepseek-chat` via `DEEPSEEK_PRO_MODEL`) / Claude Opus fallback | `mode: "pro"` — only after explicit user confirmation |

Token budgets (env-overridable):
- `PLT_FLASH_MAX_TOKENS` default `32000`
- `PLT_PRO_MAX_TOKENS` default `64000`
- `/api/chat` streaming: `max_tokens=4096` (known constraint for long drafts)

---

## Non-negotiable legal/trust guardrails

- The lawyer is always in control; outputs are drafts/work material, never decisions.
- Every factual claim must be source-linked to a quote/reference when available.
- Candidate deadlines stay visibly unconfirmed until lawyer verification.
- **Never invent facts, deadlines, statutes, or Cassazione precedents.**
- If precedent/case-law support is not verified: write `giurisprudenza da verificare in banca dati` / `DA VERIFICARE`, not a plausible fake citation.
- Use `Anonimizza` / `anonimizzazione` for privacy masking; reserve `Redigi` for legal drafting.
- Do not expose provider/model plumbing in normal lawyer-facing UI copy.
- Treat OCR (Mistral), STT (Groq Whisper), and LLM calls as **privacy-relevant external data-transfer surfaces**.

---

## Product boundaries

PLT is **not** an "AI lawyer." Frame it as:

- case organization and discovery triage;
- source-linked timelines and summaries;
- deadline and hearing prep;
- AI-assisted, lawyer-controlled legal drafting;
- lawyer productivity.

Do not overgeneralize to all law. The wedge is **Italian criminal defense**.

---

## Technical bias

Prefer:
- DeepSeek V4 Flash as default (extraction, JSON, summaries, ordinary chat).
- DeepSeek V4 Pro for deep legal reasoning (after explicit confirmation).
- Provider abstraction — never hardcode one provider into product logic.
- Source-linked structured extraction.
- Caching by file hash and incremental processing.
- Explicit cost/usage estimates before large jobs.
- Mobile-first UI; verify in a browser before calling work complete.

Avoid:
- Unlimited heavy processing.
- Token-credit language in user-facing pricing.
- Giant repeated prompt/context payloads (use compact task-specific context).
- Unsourced legal conclusions.
- Irreversible product decisions before lawyer interviews.

---

## Verification discipline

Before saying work is complete:

1. Verify target repo/path/branch/remote.
2. Run focused backend tests for any touched backend behavior:
   ```bash
   cd alpha-pwa/backend && source .venv/bin/activate && python -m pytest tests/ -q
   ```
3. Run frontend build/type checks for any touched frontend behavior:
   ```bash
   cd alpha-pwa/frontend && npm run build
   ```
   Optionally run `npm run doctor` (react-doctor) on frontend changes to catch lint / a11y / bundle-size / architecture regressions. `/doctor` (skill in `alpha-pwa/frontend/skills/react-doctor/`) runs the full local-triage workflow.
4. Run relevant frontend test scripts:
   ```bash
   npm run test:plt-export
   npm run test:local-case-scope
   npm run test:draft-workspace
   npm run test:draft-workspace-ui
   ```
5. Use browser QA for user-visible flow changes when practical.
6. Run `git diff --check` before commit.
7. **Aggiorna `07-prompts/2026-05-26-plt-ai-prompts-map.md`** se il slice cambia prompt, wording, policy Flash/Pro, o guardrail Cassazione. È il source-of-truth vivo dei prompt AI.
8. **Aggiorna `CURRENT-TASK.md`** con lo stato del slice completato e il backlog aggiornato a ogni commit significativo.
9. **Tieni la documentazione aggiornata a ogni slice — soprattutto i README** (`README.md` e `alpha-pwa/README.md`: feature list, albero del codebase, endpoint, comandi di verifica), ma anche gli altri `.md` (`CURRENT-TASK.md`, spec in `docs/`, prompt map). Se cambia architettura/feature/setup, aggiornali nello stesso commit: è parte del "fatto", non un'attività separata da ricordare.
10. **Dopo aver modificato `CLAUDE.md`, ri-clonalo identico in `AGENT.md` e `AGENTS.md` nello stesso commit** (devono restare byte-identici).
11. Se aggiungi o modifichi un prompt AI: verifica che includa il pattern DIVIETO ASSOLUTO per citazioni Cassazione (vedi P18 in `07-prompts/2026-05-26-plt-ai-prompts-map.md` come gold standard).

---

## Local dev quick start

Backend:
```bash
cd alpha-pwa/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DEEPSEEK_API_KEY=sk-...
uvicorn app.main:app --reload --port 8000
```

Frontend:
```bash
cd alpha-pwa/frontend
npm install
VITE_BYPASS_AUTH=true npm run dev
```

The Vite dev server proxies `/api/*` to `http://localhost:8000`. Auth bypass is localhost-only; deployed builds use Supabase.

---

## What NOT to commit

- `dist/`, Android build outputs, `.gradle/`, `.netlify/`, Python `.venv/`
- Real `.env` files
- `netlify.toml` contents pasted raw into docs or summaries (contains deploy/env values)
- Secrets of any kind
- `assets/screenshots/` is a gitignored scratch drop-folder; screenshots used in `README.md` are already tracked, add new doc/marketing ones with `git add -f`.

---

## Writing style

- Practical, direct, no startup fog machine.
- Concise docs with clear decisions.
- Label assumptions explicitly (`known` / `hypothesis` / `needs validation`).
- Preserve source links where available.
