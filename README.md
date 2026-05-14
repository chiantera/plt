# Pocket Legal Triage

> **Mobile-first criminal-defense case triage. Turn legal chaos into a clean case file.**

Pocket Legal Triage (PLT) is a product/workspace concept for a mobile-first legal triage app aimed first at Italian criminal-defense lawyers, then US criminal-defense lawyers.

This workspace captures the current thinking, research, pricing, architecture, validation plan, and product soul.

## Current conviction

Build **workflow**, not a generic AI chatbot.

The product should help criminal-defense lawyers convert messy inputs — PDFs, scans, photos, voice notes, audio, emails, WhatsApp messages, court dates, client memories — into:

- a source-linked case timeline;
- people/entities/evidence maps;
- missing-information checklists;
- consultation briefs;
- hearing-day briefs;
- appeal/discovery packets;
- searchable structured case memory.

## Why this could work

- Criminal defense is document/audio/chaos-heavy.
- Lawyers are mobile and time-poor.
- Existing legal software often assumes desktop workflows.
- AI economics changed with DeepSeek V4 Flash.
- DeepSeek V4 Pro may be unusually strong for Italian/civil-law reasoning.
- The wedge is honest: organization and triage, not replacing lawyers.

## Workspace map

- `AGENT.md` — operating instructions for future AI agents working in this folder.
- `AGENTS.md` — same guidance, named for tools that auto-load this convention.
- `SOUL.md` — product ethos and non-negotiables.
- `00-context/` — handoff notes and session memory.
- `01-product/` — product spec, UX flows, feature map.
- `02-research/` — market/model/OCR/legal-tech research.
- `03-business/` — pricing, unit economics, go-to-market.
- `04-technical/` — architecture, data model, model routing.
- `05-validation/` — interviews, experiments, validation scripts.
- `06-brand/` — positioning, landing page copy, names.
- `07-prompts/` — system prompts, extraction prompts, eval prompts.
- `99-archive/` — old or superseded notes.

## Best next move

Before building: validate with real criminal-defense lawyers.

Fastest useful artifact:

1. landing page draft;
2. mock case output;
3. interview script;
4. pricing/usage calculator;
5. clickable mobile wireframe.

Then talk to 5–10 Italian criminal-defense lawyers/legal assistants.

## Current model strategy

- Default model: **DeepSeek V4 Flash**.
- Fallback/deep reasoning: **DeepSeek V4 Pro**.
- OCR: provider abstraction; external OCR for MVP if faster, DeepSeek-OCR/self-host later if volume justifies.
- Premium non-DeepSeek models only as explicit fallback, not default.

## Current pricing shape

- Starter: €29/mo, capped.
- Pro: €79–99/mo.
- Firm: €199–299/mo.
- Case/discovery packs for large matters.
- No unlimited heavy processing.

## Important framing

Do **not** call it an “AI lawyer.”

Use:

> Mobile-first criminal-defense case triage.

Or:

> From discovery dump to court-ready brief.

## Current status

Concept workspace only. No app scaffold yet.
