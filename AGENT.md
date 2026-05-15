# AGENT.md — Pocket Legal Triage Workspace Instructions

You are working in `/home/user/plt`, the Pocket Legal Triage workspace.

## Mission

Design, build, and validate a mobile-first legal triage product for criminal-defense lawyers.

Core thesis:
> Turn legal chaos into a clean case file.

## Current state

A working alpha PWA exists at `alpha-pwa/`:
- FastAPI backend (port 8000) with three Italian demo cases and full AI integration
- React/Vite frontend (port 5173) with case list, case detail (6 tabs), Aula Mode, AI chat
- Provider routing: `DEEPSEEK_API_KEY` → DeepSeek; `ANTHROPIC_API_KEY` → Anthropic
- See `alpha-pwa/README.md` for setup instructions

## Product boundaries

This is not an "AI lawyer." Frame it as:
- case organization and discovery triage
- source-linked timelines and summaries
- deadline and hearing prep
- AI-assisted (not AI-autonomous) legal document drafting
- lawyer productivity

## Target markets

1. **Primary**: Italian criminal-defense lawyers
2. **Expansion**: US criminal-defense lawyers

Do not overgeneralize to all law. The wedge is criminal defense.

## Technical bias

Prefer:
- DeepSeek V4 Flash as default; DeepSeek V4 Pro for deep reasoning
- Provider abstraction — never hardcode one provider into product logic
- Source-linked structured extraction (every claim linked to a document quote)
- Caching by file hash
- Incremental processing
- Explicit cost estimates before large jobs
- Mobile-first UI

Avoid:
- Unlimited heavy processing
- Token-credit language in user-facing pricing
- Giant "analyze everything" calls
- Unsourced legal conclusions
- Irreversible product decisions before lawyer interviews

## Model routing

| Task | Model |
|---|---|
| Classification, extraction, JSON, summaries, basic briefs | DeepSeek V4 Flash |
| Deep legal reasoning, contradiction analysis, appeal prep, hard synthesis | DeepSeek V4 Pro |

## Workspace structure

```
alpha-pwa/          Working alpha PWA
00-context/         Handoff/session notes
01-product/         Specs and UX
02-research/        Market/model/OCR/legal-tech research
03-business/        Pricing, unit economics, GTM
04-technical/       Architecture, data model, model routing
05-validation/      Interviews and experiments
06-brand/           Positioning and copy
07-prompts/         Prompts and evals
```

## Writing style

- Practical, direct, no startup fog machine
- Concise docs with clear decisions
- Label assumptions explicitly
- Preserve source links where available
- Distinguish "known," "hypothesis," and "needs validation"

## Validation discipline

Before building anything substantial:
1. Interview lawyers/legal assistants
2. Show mock outputs
3. Test willingness to pay
4. Validate the mobile-first assumption
5. Validate Italy-specific workflows before US expansion

## Legal/safety posture

Always keep human lawyer judgment in the loop. Outputs should be:
- editable
- source-linked
- confidence-labeled where appropriate
- framed as drafts/triage
- never represented as definitive legal advice
