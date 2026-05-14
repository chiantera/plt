# Model Routing Notes

## Principle

Use the cheapest model that can do the job reliably, then escalate when quality or stakes require it.

## DeepSeek V4 Flash default tasks

- document classification;
- metadata extraction;
- names/dates/places extraction;
- timeline candidate extraction;
- first-pass summaries;
- missing-information questions;
- basic consultation brief;
- JSON/schema completion;
- chunk cleanup;
- low-stakes translations;
- search query expansion.

## DeepSeek V4 Pro escalation tasks

- legal issue spotting;
- appeal-prep reasoning;
- contradiction analysis;
- evaluating competing interpretations;
- final high-stakes briefs;
- quality repair where Flash fails schema/eval;
- Italian criminal-law analysis;
- civil-law procedural reasoning.

## Escalation triggers

- Flash confidence below threshold.
- User clicks “deep analysis.”
- Output type is high-stakes.
- Contradiction detected across sources.
- Jurisdiction-specific legal reasoning required.
- Flash output fails validation.
- Large synthesis across many documents.

## Cost protections

- Cache prompts/results where lawful and useful.
- Use DeepSeek context caching when stable case context is reused.
- Summarize/index incrementally instead of resending whole case.
- Use source chunks, not entire case file, for most questions.
- Show preflight estimates for deep analysis.

## Eval ideas

Create test fixtures for:

- Italian judgment/sentence extraction;
- police report timeline extraction;
- noisy client voice note;
- witness statement contradiction;
- missing mitigation evidence checklist;
- US police report discovery digest.

Score models on:

- schema validity;
- source citation correctness;
- date accuracy;
- legal terminology preservation;
- hallucination rate;
- useful missing-question generation;
- cost per completed case output.
