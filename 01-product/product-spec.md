# Product Spec Draft

## Product name

Pocket Legal Triage (PLT)

## One-liner

Mobile-first criminal-defense case triage: turn discovery dumps, scans, audio, and notes into a clean timeline, evidence map, and court/client brief.

## User personas

### Italian solo criminal-defense lawyer

- Works between court, office, clients, and phone.
- Receives messy documents and client communications.
- Needs procedural timeline, appeal-prep clarity, missing evidence checklist.
- Values privacy and mobile speed.

### Legal assistant / paralegal

- Organizes case materials.
- Needs fast extraction, labeling, timeline prep, client reminders.
- Wants less manual copy/paste.

### US criminal-defense lawyer

- Deals with large discovery volume.
- Needs police report/bodycam/interrogation/jail-call triage.
- Wants quick court/client briefing.
- Will pay for time saved.

## Core job-to-be-done

When I receive messy criminal-defense case materials in any format — PDFs, scanned pages, photos of handwritten notes, audio notes, court summons, charges, client notes, WhatsApp/screenshots, and other evidence — I want the app to parse them into a reliable, source-linked case workspace so I can prepare for client meetings, hearings, briefs, deadlines, and appeals without manually reading and sorting everything first.

This is **not** an “AI lawyer” app. It is a criminal-defense case-ingestion, organization, deadline, contradiction, and prep workspace with natural-language interaction over the lawyer’s own case corpus.

## MVP scope

### Ingest

- PDF upload
- image scan/photo upload
- audio upload
- voice note recording
- text paste
- manual event/note entry

### Process

- OCR documents
- transcribe audio
- classify document type
- extract people/dates/places/events
- detect procedural/legal milestones
- generate source-linked summaries
- generate timeline candidates
- generate missing-info questions

### Review/edit

- lawyer edits timeline
- lawyer confirms/removes extracted entities
- lawyer adds private notes
- source links remain attached

### Output

- case timeline
- facts known
- facts to verify
- missing documents
- evidence list
- next action checklist
- consultation brief
- court-day brief
- export bundle

## Non-goals for MVP

- Replacing lawyers.
- Autonomous legal advice to defendants.
- Full e-discovery platform.
- Complex firm billing/accounting.
- Court filing integrations.
- Video transcription unless audio extraction pipeline is easy.

## Key workflows

### First consultation prep

1. Lawyer creates case.
2. Uploads client documents/messages.
3. Records a voice note.
4. App generates:
   - case summary
   - timeline
   - questions to ask
   - missing documents
5. Lawyer reviews before meeting.

### Hearing-day prep

1. Open case.
2. Tap “Court-day brief.”
3. App shows:
   - next hearing details
   - key facts
   - unresolved questions
   - required documents
   - recent changes
   - client instructions

### Appeal prep

1. Upload sentence/court documents.
2. Add mitigation evidence.
3. App extracts:
   - procedural history
   - sentence details
   - grounds/issues candidates
   - missing mitigation materials
   - changed circumstances
4. Export appeal-prep packet.

### US discovery triage

1. Upload discovery batch.
2. App processes and builds index.
3. Lawyer asks:
   - mentions of weapon
   - contradictions
   - witness timeline
   - police report vs statement inconsistencies
4. App generates source-linked digest.

## Trust/safety requirements

- Source citations/links for extracted claims.
- Confidence flags.
- User-editable outputs.
- No hidden unlimited processing.
- Explicit consent before cloud AI if local/private mode is available.
- Encrypted storage.
- Audit log for firm plan.
- Clear disclaimer: organization/drafting aid, not legal advice.

## Differentiators

- Mobile-first legal intake.
- Criminal-defense-specific workflows.
- Italy/civil-law first, US criminal defense expansion.
- DeepSeek Flash economics for affordable high-volume processing.
- DeepSeek Pro for Italian law/deep reasoning.
- Source-linked timeline/evidence map.
- Transparent processing allowances and case packs.
