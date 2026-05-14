# Change Log

## 2026-05-14

Created and organized `/home/deckard/plt` workspace.

Initial files moved:

- `active-context.md` → `00-context/active-context.md`
- `product-spec.md` → `01-product/product-spec.md`
- `research-notes.md` → `02-research/research-notes.md`
- `pricing-unit-economics.md` → `03-business/pricing-unit-economics.md`

Added root/project files:

- `README.md`
- `AGENT.md`
- `AGENTS.md`
- `SOUL.md`

Added product, architecture, validation, brand, and prompt notes, including:

- `01-product/feature-map.md`
- `01-product/ux-flows.md`
- `04-technical/architecture.md`
- `04-technical/data-model.md`
- `04-technical/model-routing.md`
- `04-technical/ocr-strategy.md`
- `05-validation/validation-plan.md`
- `06-brand/landing-page-draft.md`
- `06-brand/positioning.md`
- `07-prompts/extraction-prompts.md`
- `00-context/open-questions.md`

Alpha work:

- Created `/home/deckard/plt/alpha-pwa` thin PWA alpha.
- Implemented Italian fictional criminal-defense demo case.
- Added private backend `.env` using existing Hermes DeepSeek API key without exposing it.
- Added `.gitignore` so `.env`, venvs, DBs, uploads, node modules, and builds are ignored.
- Updated OCR direction: use dedicated DeepSeek-OCR/local OCR adapter as primary OCR path, not V4 Flash/Pro as the OCR workhorse.

Current direction:

- mobile-first criminal-defense triage;
- Italy first, US expansion;
- DeepSeek V4 Flash default for extraction/structuring;
- DeepSeek V4 Pro fallback/deep reasoning;
- dedicated OCR adapter, likely DeepSeek-OCR 3B/local after validation;
- no unlimited heavy processing;
- source-linked outputs;
- validate before building.
