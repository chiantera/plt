# Pocket Legal Triage

> **Mobile-first criminal-defense case triage. Turn legal chaos into a clean case file.**

Pocket Legal Triage (PLT) is a product for Italian (and eventually US) criminal-defense lawyers. It ingests messy inputs — PDFs, scans, voice notes, court orders, police reports — and produces a source-linked, structured case file with timelines, contradiction flags, deadline tracking, and AI-drafted legal documents.

## Current conviction

Build **workflow**, not a generic AI chatbot.

The product should help criminal-defense lawyers convert messy inputs into:

- a source-linked case timeline
- people / entities / evidence maps
- missing-information checklists
- consultation briefs and hearing-day summaries
- AI-drafted memorie difensive, ricorsi, eccezioni
- searchable structured case memory

## Current status

**Working alpha PWA** — see `alpha-pwa/`. Three demo cases (furto aggravato, frode online, omicidio stradale), full legal analysis, Aula Mode court overlay, streaming AI chat with Italian criminal law system prompt and document drafting.

## Why this could work

- Criminal defense is document/audio/chaos-heavy
- Lawyers are mobile and time-poor; existing tools assume desktop
- AI economics changed dramatically with DeepSeek V4 Flash (~100x cheaper than Claude for dev)
- DeepSeek V4 Pro is strong for Italian/civil-law reasoning
- The honest wedge: organization and triage, not replacing lawyers

## Model strategy

| Mode | Default model | Premium model |
|---|---|---|
| Flash (most tasks) | DeepSeek V4 Flash | — |
| Pro (deep reasoning) | — | DeepSeek V4 Pro |

Anthropic (Claude) supported as fallback — same codebase, auto-detected from env vars.

## Pricing shape

- Starter: €29/mo
- Pro: €79–99/mo
- Firm: €199–299/mo
- Case/discovery packs for large matters

## Workspace map

```
alpha-pwa/          Working alpha PWA (FastAPI + React/Vite)
00-context/         Session handoff notes
01-product/         Product spec, UX flows, feature map
02-research/        Market, model, OCR, legal-tech research
03-business/        Pricing, unit economics, GTM
04-technical/       Architecture, data model, model routing
05-validation/      Interview scripts, experiments
06-brand/           Positioning, landing page copy
07-prompts/         System prompts, extraction prompts, evals
AGENT.md            Instructions for AI agents working in this repo
SOUL.md             Product ethos and non-negotiables
```

## Important framing

Do **not** call it an "AI lawyer."

Use:
> Mobile-first criminal-defense case triage.

Or:
> From discovery dump to court-ready brief.
