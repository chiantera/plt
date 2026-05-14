# Pricing and Unit Economics Scratchpad

## Core conclusion

DeepSeek V4 Flash changes the economics enough that a low starter tier is viable, but unlimited heavy processing is still unsafe.

Recommended structure:

- Subscription base fee.
- Included monthly processing allowance.
- Transparent overage / case packs.
- Flash-first processing.
- Pro fallback only when needed.

## Why unlimited is unsafe

Criminal-defense discovery can be extreme:

- hundreds/thousands of PDF pages
- bodycam/video-derived transcripts
- jail calls
- interrogations
- WhatsApp exports
- scans/photos
- repeated uploads
- urgent bulk case ingestion

Even cheap AI does not remove costs from:

- transcription
- OCR
- storage
- indexing
- retries
- queue infrastructure
- support
- premium fallback
- compliance/security

## Rough cost model used

Scenarios:

### Light

- 200 OCR pages
- 2 audio hours
- 5M input tokens
- 1M output token

### Normal busy

- 800 OCR pages
- 10 audio hours
- 20M input tokens
- 4M output tokens

### Heavy

- 2,500 OCR pages
- 30 audio hours
- 70M input tokens
- 12M output tokens

Assumed costs:

- OCR: $0.0015/page
- STT: $0.36/hour
- DeepSeek Flash: $0.14/M input, $0.28/M output
- DeepSeek Pro promo: $0.435/M input, $0.87/M output
- DeepSeek Pro list: $1.74/M input, $3.48/M output

## Calculated costs

### Light

- Flash + cheap OCR: ~$2.00/mo
- Pro promo + cheap OCR: ~$4.06/mo
- Pro list + cheap OCR: ~$13.20/mo

### Normal busy

- Flash + cheap OCR: ~$8.72/mo
- Pro promo + cheap OCR: ~$16.98/mo
- Pro list + cheap OCR: ~$53.52/mo

### Heavy

- Flash + cheap OCR: ~$27.71/mo
- Pro promo + cheap OCR: ~$55.44/mo
- Pro list + cheap OCR: ~$178.11/mo

## Implications

- Starter at €29/mo is viable if capped.
- Main Pro plan around €79–99/mo is healthy.
- Firm plan around €199–299/mo is healthy if quotas are sane.
- DeepSeek Pro can be used generously but not blindly as default for every pipeline stage.
- DeepSeek V4 Flash should perform the majority of extraction and summarization.
- DeepSeek V4 Pro should be tied to deep-analysis actions or quality-triggered fallback.

## Pricing draft

### Starter — €29/mo

- 300 pages/month
- 2 audio hours/month
- 10 active cases
- Flash-only analysis
- basic timeline/facts extraction
- exports

### Pro — €79–99/mo

- 1,500 pages/month
- 15 audio hours/month
- 50 active cases
- Flash analysis
- limited Pro fallback
- consultation briefs
- discovery summaries
- appeal-prep packets

### Firm — €199–299/mo

- 3+ seats
- 5,000 pages/month
- 50 audio hours/month
- shared workspace
- pooled credits
- audit logs
- admin controls

### Case packs

- Small case pack: €15–19
- Discovery pack: €49–79
- Major discovery pack: €149–249

## UI rule

Before expensive processing:

> This case contains approximately 2,400 pages and 18 audio hours. Your plan includes 800 pages and 6 audio hours remaining this month. Extra processing estimate: €X. Proceed?

Avoid surprise bills.

## Product language

Use “processing allowance,” not “token credits.”

Lawyers understand per-page, per-audio-hour, per-case costs.
