# Model Routing

## Principle

Use the cheapest model that can do the job reliably, then escalate when quality or stakes require it.

## Current implementation

Provider is auto-detected from environment variables at startup:

| Env var set | Flash model | Pro model |
|---|---|---|
| `DEEPSEEK_API_KEY` | `deepseek-v4-flash` | `deepseek-v4-pro` |
| `ANTHROPIC_API_KEY` | `claude-haiku-4-5-20251001` | `claude-opus-4-7` |

If both are set, DeepSeek takes priority. Logic lives in `alpha-pwa/backend/app/ai_service.py`.

## Flash tasks (default)

- Document classification
- Metadata / names / dates / places extraction
- Timeline candidate extraction
- First-pass summaries
- Missing-information questions
- Basic consultation brief
- JSON/schema completion
- Chat responses and legal Q&A
- Document drafting (memoria, eccezione, etc.) — surprisingly capable at this

## Pro escalation tasks

- Deep legal reasoning
- Appeal-prep issue spotting
- Contradiction analysis across many sources
- High-stakes final briefs
- Quality repair where Flash fails validation
- Italian criminal-law analysis requiring nuanced jurisprudence

## Escalation triggers

- User explicitly selects "Pro" mode
- Flash output fails schema validation
- Flash confidence below threshold
- Large synthesis across many documents
- Jurisdiction-specific legal reasoning flagged

## Cost protections

- Cache by file hash — don't re-process the same document
- Use source chunks, not entire case file, for targeted questions
- Show preflight estimates for deep analysis calls
- Summarize/index incrementally rather than resending whole case
- DeepSeek context caching where stable case context is reused

## Eval criteria

Score models on:
- Schema validity (JSON output for extraction tasks)
- Source citation correctness
- Date and timeline accuracy
- Legal terminology preservation (Italian c.p./c.p.p. references)
- Hallucination rate on legal claims
- Quality of missing-question generation
- Cost per completed case output
