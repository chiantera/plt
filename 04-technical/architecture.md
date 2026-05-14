# Technical Architecture Draft

## Architecture goal

A mobile-first app that can ingest messy legal materials, process them cheaply and reliably, and produce source-linked structured case state.

## High-level components

### Mobile app

Responsibilities:

- case list/dashboard;
- document/audio capture;
- scan/photo intake;
- quick voice notes;
- timeline review/edit;
- brief generation UI;
- usage/processing estimates;
- offline draft capture where feasible.

Likely stack: React Native / Expo.

### API/backend

Responsibilities:

- auth;
- case/project management;
- file upload orchestration;
- processing job creation;
- model provider routing;
- exports;
- billing/usage metering.

Likely stack: FastAPI or Supabase-backed service.

### Processing workers

Responsibilities:

- file hashing;
- OCR;
- STT;
- chunking;
- extraction;
- summarization;
- timeline/entity merge;
- source reference construction;
- quality checks;
- Pro fallback calls.

### Storage

- encrypted object storage for files;
- relational DB for cases, events, entities, documents, usage;
- vector/full-text index for retrieval;
- immutable audit logs for firm plan.

## Model routing

### Default path

DeepSeek V4 Flash:

- classify document;
- extract JSON;
- summarize chunks;
- generate timeline candidates;
- generate missing-info questions;
- draft basic briefs.

### Escalation path

DeepSeek V4 Pro:

- deep reasoning;
- appeal issue candidates;
- contradiction analysis;
- high-stakes synthesis;
- repair low-confidence Flash outputs;
- Italian criminal-law reasoning.

### Provider abstraction

Define providers as replaceable adapters:

- `LLMProvider`
- `OCRProvider`
- `STTProvider`
- `EmbeddingProvider`

Never hardcode one provider into product logic.

## Processing pipeline

1. Receive upload.
2. Compute hash.
3. Reuse cached OCR/STT if hash exists.
4. Store original file.
5. OCR/STT.
6. Normalize text.
7. Chunk by document structure.
8. Extract metadata/entities/events using Flash.
9. Store structured JSON.
10. Build/update case timeline.
11. Run quality checks.
12. Escalate selected tasks to Pro if needed.
13. Generate user-facing outputs with source refs.

## Source reference model

Every extracted claim should ideally point to:

- document id;
- page number or chunk id;
- audio timestamp range;
- original uploaded source;
- confidence score.

## Timeline model

PLT needs two related timelines, not just one generic chronology:

1. **Factual timeline**
   - alleged crime / underlying events;
   - witness/client/police versions;
   - contradictions between sources;
   - uncertainty/confidence and source refs.

2. **Procedural/deadline timeline**
   - court summons and hearing dates;
   - filing deadlines;
   - defense brief due dates;
   - internal work-back schedule, e.g. start drafting May 15 for a May 31 deadline and target submission at least one weekday before the official due date;
   - reminders, missing materials, and next actions.

Natural-language interaction should operate over both timelines and the full source-linked case corpus.

## Cost guard

Before large processing:

- estimate pages/audio duration;
- estimate included allowance remaining;
- estimate extra cost;
- require confirmation.

## Security/privacy baseline

- encryption at rest;
- TLS in transit;
- per-case access controls;
- firm role permissions;
- audit logs;
- deletion/export controls;
- explicit consent for cloud model processing if local/BYO options exist.

## MVP technical risks

- OCR quality on messy Italian scans.
- Audio transcription accuracy with dialect/noise/legal terms.
- Hallucinated legal conclusions.
- Maintaining source links through chunking/summarization.
- Mobile upload reliability for large files.
- App Store review if app appears to process sensitive/legal data without clear privacy disclosures.
