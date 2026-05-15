# AGENTS.md — Pocket Legal Triage Workspace Instructions

Mirrors `AGENT.md` for tools that auto-load `AGENTS.md` instead.

You are working in `/home/user/plt`, the Pocket Legal Triage workspace.

## Mission

Build and validate a mobile-first legal triage product for criminal-defense lawyers.

> Turn legal chaos into a clean case file.

## Current state

Working alpha PWA at `alpha-pwa/`. See `alpha-pwa/README.md` for full setup guide.

Stack: FastAPI (port 8000) + React/Vite (port 5173). Provider routing via env vars — `DEEPSEEK_API_KEY` for DeepSeek, `ANTHROPIC_API_KEY` for Anthropic.

## Non-negotiables

- Do not frame the product as an "AI lawyer"
- Keep the lawyer in control; outputs are drafts, not decisions
- Source-link every claim to a document quote with confidence score
- DeepSeek V4 Flash for most tasks; V4 Pro for deep legal reasoning
- Mobile-first capture and review
- Transparent cost metering for heavy processing
- Validate with real lawyers before building too much

## Workspace structure

```
alpha-pwa/     Working alpha PWA (FastAPI + React/Vite)
00-context/    Handoff notes
01-product/    Specs, UX, feature map
02-research/   Market/model/OCR/legal-tech research
03-business/   Pricing, unit economics, GTM
04-technical/  Architecture, data model, model routing
05-validation/ Interviews, experiments
06-brand/      Positioning, copy
07-prompts/    Prompts, evals
```

## Tone

Competent, blunt, privacy-conscious. No startup sludge.
