# Thin PWA Alpha Plan

## Decision

Build **Option B: thin working PWA** for Pocket Legal Triage validation.

This should be a mobile-friendly web app, not a production native app.

## Goal

Create a demo Deckard can show to criminal-defense lawyers so they understand the product through a real workflow, not abstract interview questions.

The alpha should make a lawyer say:

> “Can I try this on one of my cases?”

## Product scope

One core flow:

> Upload messy case material → process with DeepSeek → show source-linked timeline, facts, missing questions, and hearing/consultation brief.

## Recommended build strategy

### Phase 0 — Fixture first

Create one fictional/sanitized demo case with realistic criminal-defense materials:

- police report / arrest narrative;
- witness statement;
- client note or voice-note transcript;
- court notice / hearing date;
- optional judgment/sentence excerpt;
- deliberate contradiction;
- missing mitigation/evidence items.

Reason: the demo must work even if live uploads fail during a lawyer meeting.

### Phase 1 — Mobile PWA shell

Build a simple responsive app with:

- case dashboard;
- material upload/demo-material selection;
- processing status;
- timeline tab;
- people/evidence tab;
- questions tab;
- brief tab;
- source viewer.

No login needed for first alpha unless showing to external testers remotely.

### Phase 2 — Backend pipeline

Small backend service:

- receive files/text;
- hash uploaded material;
- extract text/OCR if needed;
- call DeepSeek V4 Flash for structured extraction;
- optionally call DeepSeek V4 Pro for “deep analysis”;
- return structured JSON;
- persist case state locally.

### Phase 3 — Source-linked outputs

Every extracted event/fact should preserve:

- source document name;
- page/chunk if available;
- quote;
- confidence;
- optional timestamp for audio.

### Phase 4 — Demo polish

Add:

- “processing allowance” preview;
- Flash/Pro route label;
- sample landing/demo intro screen;
- export brief to Markdown/PDF if easy;
- Italian/English labels later.

## Recommended technical stack

### Frontend

- Vite + React + TypeScript
- Tailwind CSS
- PWA/mobile responsive layout

Reason: fastest path to a clean mobile-feeling demo without Expo/native overhead.

### Backend

- FastAPI Python service
- SQLite for alpha persistence
- local filesystem storage under `/home/deckard/plt-alpha-data` or project `data/`

Reason: simple, inspectable, quick to iterate.

### AI/OCR

- DeepSeek V4 Flash default.
- DeepSeek V4 Pro optional fallback/deep-analysis endpoint.
- OCR adapter interface:
  - first path: DeepSeek V4 Flash OCR if Deckard’s test confirms it works;
  - fallback: plain text/PDF extraction or other OCR provider.

### STT

For alpha, audio can start as:

- transcript text upload;
- then optional Whisper-compatible audio transcription.

Do not block alpha on robust audio support.

## Alpha data contract

Backend returns a `CaseAnalysis` JSON object:

```json
{
  "case_summary": "string",
  "timeline": [
    {
      "date": "YYYY-MM-DD or null",
      "title": "string",
      "description": "string",
      "source_refs": [
        {
          "source_name": "police_report.pdf",
          "page": 1,
          "quote": "supporting quote",
          "confidence": 0.82
        }
      ],
      "confidence": 0.82
    }
  ],
  "people": [],
  "evidence": [],
  "open_questions": [],
  "missing_documents": [],
  "contradictions": [],
  "brief_markdown": "string",
  "usage_estimate": {
    "pages": 0,
    "audio_minutes": 0,
    "flash_input_tokens": 0,
    "flash_output_tokens": 0,
    "pro_used": false
  }
}
```

## What not to build yet

- billing;
- authentication unless needed;
- firm workspaces;
- app store packaging;
- full eDiscovery ingestion;
- production security claims;
- legal research authority database;
- many jurisdictions;
- bodycam/video.

## Validation script

In a lawyer meeting:

1. Show one-sentence pitch.
2. Open demo case.
3. Add material or use preloaded sample.
4. Process.
5. Show timeline.
6. Tap source quote.
7. Show missing questions.
8. Show court/consultation brief.
9. Ask:
   - “Would this save you time?”
   - “What output is wrong or missing?”
   - “Would you use this before court/client meetings?”
   - “Would you trust it with source links?”
   - “What would make this worth €79–99/month?”

## Success criteria

Strong alpha signal:

- lawyer asks to try it on real/sanitized case material;
- lawyer identifies a concrete workflow it would improve;
- lawyer agrees source-linked outputs are trustable enough to review;
- lawyer accepts processing allowances/overage as normal;
- lawyer says mobile access matters.

## Proposed next step

Create a project scaffold, likely under:

`/home/deckard/plt/alpha-pwa/`

Suggested structure:

```text
alpha-pwa/
├── frontend/
├── backend/
├── sample-data/
├── docs/
└── README.md
```

Before implementation, confirm:

1. Use Vite/React/Tailwind + FastAPI/SQLite?
2. Use a fictional demo case first?
3. Treat live OCR/audio as optional after the first working text/PDF flow?
