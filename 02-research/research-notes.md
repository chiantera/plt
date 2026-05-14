# Research Notes

## Mobile app / AI market signals

Quick online research surfaced these broad signals:

- AI apps are now a major consumer app category, not a novelty.
- Appfigures reported AI apps around 115M monthly downloads, $1.4B consumer spend in 2024, and projected $2B+ in 2025.
- Generic “chat with AI” assistant apps are crowded.
- The opportunity is narrower workflow-specific mobile apps, especially where AI turns messy inputs into useful structured outputs.
- Legal-tech trend reports suggest generative AI moved from experiments/pilots toward mainstream adoption in 2025.
- EU/privacy/local-first positioning matters.
- Agentic commerce and personal-agent workflows are increasingly discussed by major consultancies/analysts.

## Sources visited / surfaced

- Appfigures Rise of AI Apps report landing page.
- SensorTower State of Mobile 2025 references/search results.
- Business of Apps mobile app trends 2025 search result.
- McKinsey agentic commerce search result.
- Legal Tech Trends 2025 / legal AI mainstream search results.
- EU AI Act lawyer/compliance search results.
- DeepSeek official API pricing page.
- DeepSeek-OCR GitHub/arXiv/deepseekocr.org pages.

## DeepSeek pricing

Official DeepSeek API pricing page contained:

- deepseek-v4-flash:
  - cache-hit input: $0.0028 / 1M tokens
  - cache-miss input: $0.14 / 1M tokens
  - output: $0.28 / 1M tokens
  - 1M context
  - max output up to 384K
  - JSON output and tool calls
  - context caching

- deepseek-v4-pro:
  - promo cache-hit input: $0.003625 / 1M tokens
  - promo cache-miss input: $0.435 / 1M tokens
  - promo output: $0.87 / 1M tokens
  - list cache-hit input appeared around $0.0145 / 1M tokens
  - list cache-miss input: $1.74 / 1M tokens
  - list output: $3.48 / 1M tokens
  - promo discount noted as 75% until 2026-05-31

OpenRouter search results showed:

- V4 Flash around $0.126 input / $0.252 output per 1M.
- V4 Pro around $0.435 input / $0.87 output per 1M.

## DeepSeek benchmarks / quality notes

Search results claimed:

- V4 Flash is an efficiency-optimized MoE model with 284B total parameters / 13B active, 1M context.
- V4 Pro is a larger MoE with 1.6T total parameters / 49B active, 1M context.
- Benchmarks varied by source and should be independently verified before marketing claims.
- User observation: DeepSeek V4 Pro feels stronger than Claude for Italian law. Hypothesis: non-US model and civil-law-adjacent training/priors may be less common-law/US-centric.

## DeepSeek-OCR notes

DeepSeek-OCR paper/repo notes found:

- “Contexts Optical Compression.”
- DeepEncoder + DeepSeek3B-MoE-A570M decoder.
- Around 97% OCR precision at ~10× compression ratio in reported setting.
- Around 60% at 20× compression ratio.
- On OmniDocBench, claims strong performance using far fewer vision tokens than alternatives.
- Claimed production throughput: 200K+ pages/day on single A100-40G.
- Code/model weights available.

Caveat:

- Hosted DeepSeek V4 pricing page did not clearly present standard hosted image/OCR pricing. Treat OCR as a separate swappable subsystem.

## Competitive/product insight

The app should avoid being a thin AI wrapper.

Defensible value comes from:

- domain workflow
- source-linked case structure
- mobile capture
- legal-specific outputs
- jurisdiction templates
- privacy/compliance posture
- processing economics
- saved lawyer time before court/client meetings

## User insight

Lawyers are too busy to get on their PC. Mobile-first or very mobile-friendly is not a gimmick; it is central.
