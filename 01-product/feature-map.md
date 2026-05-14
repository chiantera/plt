# Feature Map

## Product layers

### Capture

- scan paper document
- upload PDF
- import images
- record voice note
- upload audio
- paste text/messages
- add manual event
- add court date/deadline

### Processing

- OCR
- STT/transcription
- document classification
- entity extraction
- date/deadline extraction
- event extraction
- evidence tagging
- legal/procedural marker detection
- contradiction candidate generation
- missing-info generation

### Case structure

- timeline
- people/entities
- evidence list
- document library
- audio/transcript library
- deadlines
- open questions
- procedural history
- mitigation evidence
- issue candidates

### Outputs

- first consultation brief
- hearing-day brief
- client question list
- missing-document checklist
- appeal-prep packet
- discovery digest
- contradiction matrix
- witness timeline
- export bundle

### Administration

- usage/processing allowance
- billing/case packs
- firm seats/roles
- audit logs
- privacy settings
- provider settings / BYO API key later

## MVP cut

Build only enough to test value:

1. Case creation.
2. PDF/image/audio/voice-note ingest.
3. OCR/STT.
4. Flash extraction to structured JSON.
5. Timeline and facts-to-verify.
6. Consultation brief.
7. Export.
8. Usage estimate display.

## Later features

- collaborative firm workspace
- client portal/intake links
- WhatsApp/email import
- calendar integrations
- jurisdiction template packs
- bodycam/video handling
- advanced contradiction finder
- appeal issue spotter
- local/self-hosted mode
- BYO model keys
