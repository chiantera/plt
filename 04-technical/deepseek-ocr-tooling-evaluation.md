# DeepSeek-OCR Tooling Evaluation

## Source

Deckard pasted DeepSeek V4's suggested ecosystem list on 2026-05-14.

## Verification status

I treated the list as leads and checked GitHub search/API plus raw READMEs where possible.

Important result: several exact project/name combinations from V4's answer did **not** show up in quick GitHub repository search:

- `Gershonbest deep-ocr DeepSeekOCR` — no exact repo found in quick search.
- `JackChen-me deepseek-visor-agent` — no exact repo found in quick search.
- `wisdomfriend deepseek-ocr-fastapi` — no exact repo found in quick search.
- `wcpsoft deepseek-ocr-cli` — no exact repo found in quick search.
- `zademy deepSeek-ocr-docker-compose` — no exact repo found in quick search.
- `Dogacel Universal-DeepSeek-OCR-2` — no exact repo found in quick search.
- `arrase Ollama DeepSeek-OCR` — no exact repo found in quick search.
- `sandraschi ocr-mcp DeepSeek-OCR-2` — no exact repo found in quick search.

This does **not** prove they do not exist; names may be off, private, moved, new, or indexed poorly. But it means we should not build around them until Deckard sends actual URLs.

## Verified / promising leads

Broader GitHub search for `DeepSeek-OCR` found real projects:

- `deepseek-ai/DeepSeek-OCR`
  - official repository;
  - Hugging Face model link in README;
  - notes upstream vLLM support;
  - DeepSeek-OCR2 release points to separate repo.
- `deepseek-ai/DeepSeek-OCR-2`
  - official OCR 2 repository;
  - Hugging Face model link in README;
  - README includes vLLM and Transformers inference sections.
- `TimmyOVO/deepseek-ocr.rs`
  - broader search found it with significant stars and description claiming Rust multi-backend OCR/VLM engine, OpenAI-compatible server, CLI, CPU/Metal/NVIDIA.
  - Raw README path checked at `main` returned 404, so branch/path needs inspection before use.
- `oomol-lab/pdf-craft`
  - not necessarily DeepSeek-specific, but relevant for scanned PDF conversion.
- `th1nhhdk/local_ai_ocr`
  - local/offline OCR app around DeepSeek-OCR, possibly useful as reference.

GitHub API rate-limited additional searches after the first broad query, so this is a first pass, not final due diligence.

## PLT recommendation

For the alpha, do **not** start with a random community wrapper unless it has a real URL and we inspect code/dependencies.

Recommended order:

1. **OCR adapter contract first**
   - Keep backend app independent of any specific OCR engine.
   - Define `OcrResult` JSON with pages, text, confidence, engine, warnings.

2. **Official DeepSeek-OCR-2 local spike**
   - Try official `deepseek-ai/DeepSeek-OCR-2` first.
   - Reason: official upstream, clear model download, vLLM/Transformers paths.
   - Test on one-page Italian legal scan and one mobile photo.

3. **Rust server spike if local Python stack is painful**
   - Investigate `TimmyOVO/deepseek-ocr.rs` only after checking repo structure and license.
   - Attractive because it may expose an OpenAI-compatible server and avoid Python runtime mess.

4. **Community FastAPI/Docker wrappers only with real URLs**
   - Useful if one is maintained and simple.
   - But do not trust V4's exact package names yet.

5. **Hosted/free OCR only for synthetic demos**
   - Avoid uploading real lawyer/client material to unknown free sites.

## Alpha implementation plan

Next OCR-related code should be:

```text
backend/app/ocr_models.py      # OcrResult, OcrPage, OcrWarning
backend/app/ocr_adapter.py     # interface + placeholder/local stub
backend/tests/test_ocr_contract.py
```

Then later:

```text
backend/app/ocr_deepseek_local.py
backend/app/ocr_deepseek_rs_client.py
```

The app's analysis route should consume normalized OCR text, not know which OCR engine produced it.
