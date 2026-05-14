# OCR Strategy — Dedicated DeepSeek-OCR Track

## Decision

Do **not** treat DeepSeek V4 Flash/Pro as the long-term OCR engine just because V4 can read images.

The OCR layer should be its own replaceable subsystem.

## Current hypothesis

Use:

- **DeepSeek-OCR 3B / dedicated OCR model** for OCR, if quality/deployment validates;
- **DeepSeek V4 Flash** for downstream extraction and structured case triage;
- **DeepSeek V4 Pro** only for hard reasoning/escalation.

## Why separate OCR from legal reasoning

OCR is a high-volume commodity-ish workload:

- many pages;
- many scans;
- quality varies by image;
- cost and latency matter;
- output must be cached and reused.

Legal reasoning is a lower-volume/high-value workload:

- contradiction analysis;
- issue spotting;
- procedural strategy;
- appeal/custody risk;
- synthesis across many documents.

Mixing these into one model route risks wasting expensive reasoning capacity on page-reading.

## Architecture implication

Pipeline should be:

```text
file/image/pdf
  ↓
OCR adapter
  ↓
normalized text + page refs + confidence
  ↓
chunker
  ↓
DeepSeek V4 Flash extraction
  ↓
source-linked CaseAnalysis JSON
  ↓
optional DeepSeek V4 Pro escalation
```

## OCR adapter contract

Input:

- file path or uploaded bytes;
- mime type;
- optional language hint, default `it`;
- optional page range.

Output:

```json
{
  "success": true,
  "engine": "deepseek-ocr-3b-local",
  "pages": [
    {
      "page": 1,
      "text": "...",
      "confidence": 0.94,
      "blocks": []
    }
  ],
  "warnings": []
}
```

## Tooling direction after V4's OCR notes

V4 listed a broad ecosystem of wrappers, CLIs, Docker stacks, a Rust implementation, and an MCP server. Quick verification found official DeepSeek OCR repositories and a promising Rust project, but several exact community package names from the list did **not** show up in quick GitHub search.

Therefore:

1. Do not bind the alpha to a community wrapper until we have actual URLs and inspect the code.
2. Start with an OCR adapter contract in the backend.
3. Test official `deepseek-ai/DeepSeek-OCR-2` first.
4. Investigate `TimmyOVO/deepseek-ocr.rs` as a second spike if Python/vLLM/Transformers is too heavy.
5. Treat any free hosted OCR route as synthetic-demo-only unless privacy terms are acceptable.

Detailed notes: `04-technical/deepseek-ocr-tooling-evaluation.md`.

## Things to test

- Can official DeepSeek-OCR-2 run locally on Deckard's machine without GPU pain?
- Does it handle Italian legal scans well?
- Does it preserve page order and useful layout?
- Does it handle low-quality mobile photos?
- Is the “online free” endpoint reliable/legal/safe enough for lawyer data? Probably not for real client data; maybe acceptable only for synthetic demos.
- What is throughput per 100 pages?
- Can we cache by file hash and page hash?
- Does the Rust route expose a stable CLI/server we can call from FastAPI?

## Privacy stance

For real legal materials, avoid random independent OCR websites unless:

- materials are synthetic/anonymized;
- the lawyer explicitly consents;
- the endpoint has acceptable privacy terms;
- no privileged/client-sensitive data is uploaded.

For production, prefer local or controlled hosted OCR.
