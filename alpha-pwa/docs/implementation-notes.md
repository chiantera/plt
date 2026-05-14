# Alpha Implementation Notes

## 2026-05-14

Implemented first thin PWA scaffold after Deckard approved Option B and reminded: “Italian text”.

## Implemented

- `/home/deckard/plt/alpha-pwa/backend`
  - FastAPI app.
  - Pydantic data contract for `CaseAnalysis`.
  - Italian fictional criminal-defense demo fixture.
  - Tests verifying Italian language, source refs, contradictions, open questions, and DeepSeek Flash-first usage route.
- `/home/deckard/plt/alpha-pwa/frontend`
  - Vite/React/TypeScript app.
  - Mobile-first CSS.
  - Italian UI.
  - Tabs: Timeline, Persone & prove, Da verificare, Promemoria.
  - Source drawer for source-linked claims.
- `/home/deckard/plt/alpha-pwa/sample-data`
  - Raw fictional Italian materials for the demo case.

## Deliberate limitations

- No real DeepSeek API call yet.
- No OCR yet.
- No audio/STT yet.
- No auth/billing/firm features.

## Technical choices

- Start with structured fixture data so demos have a reliable golden path.
- Preserve source refs in every major object because competitor scan confirmed source grounding is mandatory.
- Italian-first copy and fictional Italian criminal-defense facts.

## Next slice

Add real analysis endpoint:

`POST /api/analyze-text`

Input:

- title;
- one or more text materials;
- optional mode: `flash` or `pro`.

Output:

- same `CaseAnalysis` shape.

Then update frontend to let Deckard paste/upload text and switch between fixture and live analysis.
