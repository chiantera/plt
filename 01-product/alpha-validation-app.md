# Alpha Validation App — Scope Draft

## Purpose

Build an alpha version of Pocket Legal Triage that Deckard can show to lawyers to make the idea concrete.

This is not production software. It is a validation artifact.

The alpha should answer:

> “If this existed, would a criminal-defense lawyer want to use/pay for it?”

## Core demo promise

A lawyer can upload or scan messy case material and see:

- a timeline;
- key people/events/evidence;
- missing questions;
- a consultation or hearing brief;
- source references back to the uploaded material.

## Why an alpha is better than only interviews

Lawyers may not understand “AI case triage” abstractly. They will understand:

- “here is your case timeline”;
- “here are the unanswered questions”;
- “here is what to ask the client”;
- “here is what changed before the hearing”;
- “tap this fact to see the source page/audio timestamp.”

## Alpha product rule

Do not build broad legal AI. Build one impressive criminal-defense workflow.

Recommended demo workflow:

> First consultation / hearing-prep case triage from mixed inputs.

## Alpha MVP features

### Must-have

1. Create/select demo case.
2. Upload PDF/image/text/audio or use preloaded sample case.
3. Run OCR/STT/extraction.
4. Show processing status.
5. Show timeline.
6. Show people/entities.
7. Show missing questions / documents needed.
8. Generate consultation/hearing brief.
9. Show source refs for at least some claims.
10. Show usage estimate/processing allowance concept.

### Nice-to-have

- Voice note capture.
- Mobile scan flow.
- Export brief to PDF/Markdown.
- Italian/English toggle.
- DeepSeek Flash vs Pro route indicator.
- “Deep analysis” button that clearly costs more credits.

### Not for alpha

- Full billing.
- Firm multi-user roles.
- Real secure production storage.
- Full legal research database.
- US eDiscovery at scale.
- App Store release.
- Bodycam/video pipeline.
- Court filing integrations.

## Recommended technical shape

Fastest credible alpha:

- **Frontend:** Expo React Native or mobile-friendly web/PWA.
- **Backend:** FastAPI small service.
- **Storage:** local filesystem or simple object store for alpha.
- **DB:** SQLite/Postgres/Supabase.
- **AI:** DeepSeek V4 Flash default, Pro fallback button.
- **OCR:** use Deckard’s current DeepSeek V4 Flash OCR experiment if good enough; otherwise adapter fallback.
- **STT:** Whisper-compatible transcription.

## Demo data strategy

Use one sanitized fictional criminal-defense case with:

- police report PDF/text;
- witness statement;
- client voice note;
- court notice;
- judgment/sentence excerpt;
- photos/scans if possible.

The sample should include:

- dates that need ordering;
- two inconsistent statements;
- missing mitigation evidence;
- upcoming deadline;
- one ambiguous fact requiring a client question.

## Alpha screens

1. Home / case list.
2. Case dashboard.
3. Add material.
4. Processing queue.
5. Timeline.
6. Evidence/people.
7. Questions to ask.
8. Brief.
9. Source viewer.
10. Usage estimate.

## Demo script

1. “Here is a messy case file.”
2. Upload materials / use demo case.
3. Tap process.
4. Show generated timeline.
5. Tap one event and show source page/quote.
6. Show questions to ask client.
7. Generate court-day or consultation brief.
8. Ask lawyer:
   - Would this save time?
   - What is wrong/missing?
   - Would you trust this if source-linked?
   - Would you pay for this?
   - What workflow should be first?

## Competitive lesson applied

From reviewed competitors:

- Opus 2 validates chronology and litigation context.
- Relativity validates defensibility and human-verifiable analysis.
- Everlaw validates direct citations and insufficient-info behavior.
- Vincent by Clio validates mobile legal AI for hallway/commute/court use.
- Claude for Legal validates legal-specific onboarding, plugins, and matter-context workflows.

PLT alpha should therefore emphasize:

- mobile use;
- criminal-defense specificity;
- case timeline;
- source refs;
- actionable prep brief;
- DeepSeek-powered affordability.

## Alpha success criteria

A lawyer says at least one of:

- “Can I try this on a real case?”
- “This would save me time before hearings.”
- “My assistant/paralegal should use this.”
- “If it handled audio/scans reliably, I’d pay.”
- “This is better than asking ChatGPT because it organizes the case.”

## Alpha failure signals

- They see it as generic ChatGPT.
- They only care about legal research, not case organization.
- Source refs are too weak to trust.
- Mobile workflow feels unnecessary.
- They refuse any cloud processing and local-first is required immediately.

## Recommended next step

Before coding, write a short alpha spec and choose the fastest prototype form:

A. **Clickable Figma-style mock / static web demo** — fastest for interviews, fake processing.
B. **Thin working PWA** — upload sample docs, call DeepSeek, show real output.
C. **Expo mobile alpha** — most convincing mobile-first demo, slower to build.

Recommendation: **B first**, because real DeepSeek OCR/Flash output will be persuasive and still faster than a polished native app.
