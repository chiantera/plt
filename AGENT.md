# AGENT.md — Pocket Legal Triage Workspace Instructions
_Last updated: 2026-05-27 02:46 Europe/Berlin by Codex_

You are working in `/home/deckard/plt`, the Pocket Legal Triage workspace.

Repo: `chiantera/plt` (`origin https://github.com/chiantera/plt.git`). Current working convention: commit coherent slices directly to `main` and push, unless Deckard explicitly asks for a branch/worktree.

## Mission

Design, build, and validate a mobile-first legal triage product for criminal-defense lawyers.

Core thesis:
> Turn legal chaos into a clean case file.

## Current app state

A working alpha PWA exists at `alpha-pwa/`:

- FastAPI backend: `alpha-pwa/backend` (local port 8000).
- React/Vite frontend: `alpha-pwa/frontend` (local port 5173).
- Public frontend: `https://pocket-legal-triage.netlify.app`.
- Public backend health: `https://plt-backend.onrender.com/api/health`.
- Provider routing: `DEEPSEEK_API_KEY` → DeepSeek; fallback `ANTHROPIC_API_KEY` → Anthropic.
- Default product language and legal wedge: Italian criminal defense.
- See `alpha-pwa/README.md` for setup instructions.

## Read first at the start of every PLT thread

1. `CURRENT-TASK.md` — latest handoff, branch/head, verification, next steps, and active backlog notes. This is the first place to check for Deckard's current priorities.
2. `07-prompts/2026-05-26-plt-ai-prompts-map.md` — living prompt inventory; update it whenever prompt behavior changes.
3. `07-prompts/extraction-prompts.md` — historical rough prompt sketches only; do not treat as source of truth.
4. `04-technical/` and `01-product/` for architecture/product decisions when relevant.
5. `alpha-pwa/backend/app/ai_service.py`, `alpha-pwa/frontend/src/prompts/`, `alpha-pwa/frontend/src/draftArtifacts.ts`, and `alpha-pwa/frontend/src/main.tsx` before changing AI behavior.

Hermes-specific note: Hermes auto-loads repo-local `AGENTS.md` when running from this workspace. Keep `AGENT.md` and `AGENTS.md` synchronized because different tools look for different filenames.

## Current priority themes

- Keep improving the in-app AI prompts and prompt map.
- **Politica anti-allucinazione Cassazione — DIVIETO ASSOLUTO:** tutti i prompt AI usano ora la formula "DIVIETO ASSOLUTO + percorso alternativo" (descrivi il principio e la norma senza inventare estremi; scrivi "orientamento giurisprudenziale da ricercare in banca dati"). `DA VERIFICARE` e `flagUnverifiedCassationCitations()` in `draftArtifacts.ts` restano come rete di sicurezza post-processing. Il gold standard è P18 (`DRAFT_PRECEDENT_GUARDRAIL`). Quando aggiungi o modifichi un prompt, applica lo stesso schema. In assenza di RAG verificato, qualsiasi citazione Cassazione generata dal modello va trattata come inventata.
- Keep track of frontend usability fixes in `CURRENT-TASK.md`, including the FAB hide/dismiss interaction and broader FE polish backlog.
- Preserve the new Flash/Pro split:
  - Flash/standard = extraction, structure, concise fields, no deep strategy by default.
  - Pro = deeper reasoning across contradictions, procedural risks, defensive hypotheses, missing evidence, and next actions.
- Pro is recommended, not silently run: show `Approfondimento Pro con GiulIA`; require explicit confirmation before sending `mode: "pro"`; no automatic charge.
- Continue frontend restructuring from the giant `main.tsx` into domain types, utilities, prompt modules, UI primitives, screens/features.
- Keep an authenticated/live E2E check on the Pro recommendation card as an optional verification follow-up.

## Product boundaries

This is not an "AI lawyer." Frame PLT as:

- case organization and discovery triage;
- source-linked timelines and summaries;
- deadline and hearing prep;
- AI-assisted, lawyer-controlled legal drafting;
- lawyer productivity.

Do not overgeneralize to all law. The wedge is Italian criminal defense.

## Non-negotiable legal/trust guardrails

- The lawyer is always in control; outputs are drafts/work material, not decisions.
- Every factual claim should be source-linked to a quote/reference when available.
- Candidate deadlines stay visibly unconfirmed until lawyer verification.
- Never invent facts, deadlines, citations, or Cassazione precedents.
- If precedent/case-law support is not verified, say `giurisprudenza da verificare in banca dati` / `DA VERIFICARE`, not a plausible fake citation.
- Use `Anonimizza` / `anonimizzazione` for privacy masking; reserve `Redigi` for legal drafting.
- Do not expose provider/model plumbing in normal lawyer-facing UI copy.
- Treat OCR/STT/model calls as privacy-relevant external data-transfer surfaces.

## Technical bias

Prefer:

- DeepSeek V4 Flash as default for extraction, JSON, summaries, ordinary chat.
- DeepSeek V4 Pro for deep legal reasoning, contradictions, appeal prep, difficult synthesis.
- Provider abstraction — never hardcode one provider into product logic.
- Source-linked structured extraction.
- Caching by file hash and incremental processing.
- Explicit cost/usage estimates before large jobs.
- Mobile-first UI and browser verification.

Avoid:

- Unlimited heavy processing.
- Token-credit language in user-facing pricing.
- Giant repeated prompt/context payloads when a compact task-specific context would work.
- Unsourced legal conclusions.
- Irreversible product decisions before lawyer interviews.

## Model routing

- Classification, extraction, JSON, summaries, basic briefs: DeepSeek V4 Flash / `mode: "flash"`.
- Deep legal reasoning, contradiction analysis, appeal prep, hard synthesis: DeepSeek V4 Pro / `mode: "pro"` after explicit user confirmation.

## Workspace structure

```text
alpha-pwa/          Working alpha PWA
00-context/         Handoff/session notes
01-product/         Specs and UX
02-research/        Market/model/OCR/legal-tech research
03-business/        Pricing, unit economics, GTM
04-technical/       Architecture, data model, model routing
05-validation/      Interviews and experiments
06-brand/           Positioning and copy
07-prompts/         Prompts, prompt maps, evals
CURRENT-TASK.md     Current handoff and next steps
```

## Verification discipline

Before saying work is complete:

1. Verify target repo/path/branch/remote.
2. Run focused backend tests for touched backend behavior.
3. Run frontend build/type checks for touched frontend behavior.
4. Use browser QA for user-visible flow changes when practical.
5. Run `git diff --check` before commit.
6. **Aggiorna `07-prompts/2026-05-26-plt-ai-prompts-map.md`** se cambi qualsiasi prompt, wording, policy Flash/Pro, o guardrail Cassazione. È il source-of-truth vivo dei prompt.
7. **Aggiorna `CURRENT-TASK.md`** con lo stato del slice e il backlog aggiornato.
8. **Aggiorna `README.md` e `alpha-pwa/README.md`** se cambia l'architettura, le feature principali, o le istruzioni di setup.
9. Se aggiungi o modifichi un prompt AI: verifica che includa il pattern DIVIETO ASSOLUTO per le citazioni Cassazione.

## Writing style

- Practical, direct, no startup fog machine.
- Concise docs with clear decisions.
- Label assumptions explicitly.
- Preserve source links where available.
- Distinguish `known`, `hypothesis`, and `needs validation`.
