# Model Routing
_Last updated: 2026-11-06_

## Principle

Use the cheapest model that can do the job reliably, then escalate when quality or stakes require it.

## Current implementation

`_routes(mode)` in `alpha-pwa/backend/app/ai_service.py` builds the provider order for each call from the environment:

| Keys set | Provider order |
|---|---|
| `DEEPSEEK_API_KEY` only | DeepSeek, no failover |
| Both | DeepSeek, then Anthropic if DeepSeek fails |
| `ANTHROPIC_API_KEY` only | Anthropic |

| Mode | DeepSeek | Anthropic |
|---|---|---|
| `flash` | `deepseek-v4-flash` (`DEEPSEEK_DEFAULT_MODEL`) | `claude-haiku-4-5-20251001` |
| `pro` | `deepseek-v4-pro` (`DEEPSEEK_PRO_MODEL`) | `claude-opus-4-7` |

Failover stays on the tier the request asked for. A Flash call cannot become Opus, and Pro still runs only after the lawyer confirms it.

## Runtime failover

When `ANTHROPIC_API_KEY` is set, any failure of the DeepSeek call moves the request to Anthropic:

- HTTP errors, including 429, 5xx, 401 and 402
- connection errors and stalled reads
- a stream that closes before completing
- `finish_reason` of `insufficient_system_resource` or `aborted` inside an HTTP 200

| Path | Code | Can fail over |
|---|---|---|
| Background jobs, `POST /api/analyze-jobs` | `analyze_case` | At any point. The text stays on the server until it is complete. |
| SSE analysis, `POST /api/analyze-text` | `stream_analyze_case` | At any point. The text stays on the server until it is complete. |
| Chat and drafts, `POST /api/chat` | `stream_chat` | Until the first visible token, including the whole reasoning phase. |

**Chat does not switch provider after visible text has reached the client.** Splicing a second model's output into a legal draft could duplicate or lose text without warning, and the frontend's SSE readers cannot discard what they have already rendered. The stream ends abnormally instead, as it did before failover existed, so `fetchChatFull` rejects rather than saving a truncated draft as finished. A retry goes through normal routing.

When every provider fails, analysis returns the existing localized error (Italian, English or German) and chat ends the stream abnormally, which triggers the frontend's existing error handling. The SSE wire format is unchanged: `data: {"text": ...}`, `: ping`, `data: [DONE]`. Do not add a new `data:` event shape to chat, because the frontend readers append `.text` from every data frame and would render "undefined".

Client limits apply to both providers:

| Env var | Default | Purpose |
|---|---|---|
| `PLT_LLM_READ_TIMEOUT_SECONDS` | `120` | Longest silence between bytes, not a limit on the whole response |
| `PLT_LLM_CONNECT_TIMEOUT_SECONDS` | `10` | Connection timeout |
| `PLT_LLM_MAX_RETRIES` | `1` | SDK retries on the same provider before failing over |

Anthropic calls always stream, because the SDK refuses large non-streaming requests. Their output budget is capped at the model limit (64K for Haiku 4.5, 128K for Opus 4.7), and chat history is cleaned of empty, leading and trailing assistant turns, which the Messages API rejects.

### Known limits

- **Data transfer:** failover sends the same case material to a second external provider. `render.yaml` does not declare `ANTHROPIC_API_KEY`, so failover stays off on Render unless the key was added in the dashboard.
- **Not triggered by bad output:** unparseable or schema-invalid JSON from a call that completed normally is an analysis error, not a failover.
- **Context size:** DeepSeek V4 has a 1M-token context and Haiku 4.5 has 200K. A very large Flash analysis can fit DeepSeek and then be rejected by Haiku. The request fails with an error and nothing is silently truncated.
- **No overall deadline:** the read timeout detects silence only. A provider sending keepalives can hold a call until it closes the connection, which DeepSeek documents as 10 minutes for a request that has not started.
- **Proxies (needs validation):** a mid-stream break makes the browser's reader reject when connected directly to uvicorn. Through the Vite dev proxy the read hangs instead, because the proxy does not forward the upstream abort. The Vercel rewrite and Render's edge are untested.

### Verification status

`tests/test_llm_failover.py` and `tests/test_llm_telemetry.py` run the real `openai` and `anthropic` SDKs over a fake HTTP transport. The chat and analysis paths were also run in a browser against the real frontend with fake providers. **No call has been made to a live provider.** To check it live with a real Anthropic key and non-sensitive text:

```bash
cd alpha-pwa/backend
DEEPSEEK_API_KEY=invalid ANTHROPIC_API_KEY=<real key> uvicorn app.main:app --port 8000
```

```bash
curl -N -X POST localhost:8000/api/chat -H 'Content-Type: application/json' -d '{"messages":[{"role":"user","content":"Ciao"}]}'
```

The reply should stream normally, and the server log should show `"outcome":"switched"` with `"reason":"auth"`, then `"provider":"anthropic"` with `"status":"ok"`.

## Observability

`alpha-pwa/backend/app/llm_telemetry.py` records every call as structured logs on the `plt.llm` logger, one JSON object per line after the standard log prefix. Failures log at `WARNING`.

```text
WARNING:plt.llm:{"call_id":"be53a01cc16942dd","endpoint":"stream_chat","mode":"flash","outcome":"switched","from_provider":"deepseek","from_model":"deepseek-v4-flash","reason":"rate_limit","http_status":429,"to_provider":"anthropic","to_model":"claude-haiku-4-5-20251001","skip_reason":null,"event":"llm_failover"}
```

| Event | Emitted | Fields |
|---|---|---|
| `llm_call` | Once per provider attempt | `call_id`, `endpoint`, `attempt`, `is_failover`, `provider`, `model`, `mode`, `status` (`ok`, `error`, `cancelled`), `latency_ms`, `first_token_ms`, `input_tokens`, `output_tokens`, `cached_input_tokens`, `estimated_cost_usd`, `finish_reason`, `error_kind`, `error_type`, `http_status` |
| `llm_failover` | Once per failover decision | `call_id`, `endpoint`, `mode`, `outcome` (`switched`, `skipped`), `from_provider`, `from_model`, `reason`, `http_status`, `to_provider`, `to_model`, `skip_reason` |

All attempts of one request share a `call_id`. The provider that served a request is the `llm_call` with `"status":"ok"`.

**Cost** is an estimate from the price table in `llm_telemetry.py`, checked against provider pricing on 2026-11-06. It includes DeepSeek's peak and off-peak rates and cache-hit pricing, but not Chinese public holidays, when it reads high. An unlisted model or missing usage gives `null`, never a guess. A cancelled or failed call often has no usage, so totals from these logs are a lower bound.

**Tracing hook:** `add_sink(callable)` delivers each event object to another consumer, and a failing sink cannot affect the call. No tracing backend is connected yet. A Langfuse or OpenTelemetry adapter registers at startup and maps `provider`, `model`, `input_tokens`, `output_tokens`, `finish_reason` and `error_type` to its own fields, such as the OpenTelemetry `gen_ai.*` attributes.

**Case content is never recorded.** These event types have no field that can hold it, and `error_type` is an exception class name because provider error messages can echo request data. The tests plant a marker string in titles, documents, instructions, messages and model output, then fail if it reaches any log line, traceback or event. To keep this true:

- Leave `PLT_PROMPT_LOG` unset on deployed services. It writes full prompts to disk and is now opt-in.
- Do not run the backend at `DEBUG` log level in production, because the Anthropic SDK logs request bodies at that level.
- Keep the Anthropic SDK's OpenTelemetry content mode at its default, `metadata_only`, if a tracer provider is added.

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

Pro runs only when the lawyer explicitly selects it (`auto_charge: false`). `_build_pro_recommendation` suggests it for contradictions, candidate or urgent deadlines, missing documents, serious charges, custody measures, evidence conflicts and strategy or drafting requests.

Not implemented (hypothesis): suggesting Pro when Flash output fails schema validation, when Flash confidence is low, or for large synthesis across many documents.

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
