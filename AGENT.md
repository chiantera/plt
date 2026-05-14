# AGENT.md — Pocket Legal Triage Workspace Instructions

You are working in `/home/deckard/plt`, the Pocket Legal Triage concept workspace.

## Mission

Help design and validate a mobile-first legal triage product for criminal-defense lawyers.

The product thesis:

> Turn legal chaos into a clean case file.

## Product boundaries

This is not an “AI lawyer.” Do not frame it as autonomous legal advice.

Frame it as:

- case organization;
- discovery triage;
- source-linked summaries;
- timeline building;
- consultation/hearing prep;
- appeal/discovery packet generation;
- lawyer productivity.

## Target markets

1. Initial test market: Italian criminal-defense lawyers.
2. Expansion: US criminal-defense lawyers.

Do not overgeneralize to all law. The wedge is criminal defense.

## Deckard’s core observations

- Lawyers are too busy/mobile to depend on desktop workflows.
- Mobile-first or genuinely mobile-friendly is essential.
- DeepSeek V4 Flash should power most AI features.
- DeepSeek V4 Pro should handle fallback/deep legal reasoning.
- DeepSeek V4 Pro feels better than Claude for Italian criminal law.
- Pricing must account for heavy OCR/audio/document workloads.

## Technical bias

Prefer:

- DeepSeek V4 Flash default;
- DeepSeek V4 Pro fallback;
- provider abstraction for models/OCR/STT;
- source-linked structured extraction;
- caching by file hash;
- incremental processing;
- explicit cost estimates before large jobs;
- local/private options where feasible.

Avoid:

- unlimited heavy processing;
- token-credit language in user-facing pricing;
- giant “analyze everything” calls;
- unsourced legal conclusions;
- irreversible product decisions before lawyer interviews.

## Documentation conventions

Keep root clean.

Use folders:

- `00-context/` for handoff/session notes.
- `01-product/` for specs and UX.
- `02-research/` for source notes.
- `03-business/` for pricing/GTM.
- `04-technical/` for architecture/data/model routing.
- `05-validation/` for interviews and experiments.
- `06-brand/` for positioning/copy.
- `07-prompts/` for prompts/evals.
- `99-archive/` for stale notes.

## Writing style

- Practical, direct, no startup fog machine.
- Prefer concise docs with clear decisions.
- Label assumptions.
- Preserve source links or source names where available.
- Distinguish “known,” “hypothesis,” and “needs validation.”

## Validation discipline

Before building anything substantial:

1. Interview lawyers/legal assistants.
2. Show mock outputs.
3. Test willingness to pay.
4. Validate the mobile-first assumption.
5. Validate Italy-specific workflows before US expansion.

## Legal/safety posture

Always keep human lawyer judgment in the loop.

Outputs should be:

- editable;
- source-linked;
- confidence-labeled where needed;
- framed as drafts/triage;
- not represented as definitive legal advice.

## Immediate next useful artifacts

- Interview script.
- Landing page draft.
- Mobile wireframe notes.
- Sample case output.
- Architecture plan.
- Pricing calculator.
