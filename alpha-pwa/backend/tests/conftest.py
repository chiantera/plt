"""Fake LLM providers for the failover and telemetry tests.

The fakes sit at the HTTP transport, underneath the real `openai` and `anthropic`
SDKs. Real SSE parsing, real exception classes and real SDK guards all run; only the
network is replaced, so these tests make no external calls.
"""

import json

import anthropic
import httpx2
import openai
import pytest

from app import ai_service, llm_telemetry


class FakeProvider:
    """Records each request body and answers with a scripted response."""

    def __init__(self, name):
        self.name = name
        self.requests = []
        self.respond = lambda request: pytest.fail(f"unexpected call to {name}")

    def __call__(self, request):
        self.requests.append(json.loads(request.content))
        return self.respond(request)


def _sse_response(body):
    return httpx2.Response(200, headers={"content-type": "text/event-stream"}, content=body)


def _deepseek_chunk(content=None, reasoning=None, finish_reason=None, usage=None):
    frame = {
        "id": "c1",
        "object": "chat.completion.chunk",
        "created": 1,
        "model": "fake",
        "choices": [{
            "index": 0,
            "delta": {"role": "assistant", "content": content, "reasoning_content": reasoning},
            "finish_reason": finish_reason,
        }],
        "usage": usage,
    }
    return f"data: {json.dumps(frame)}\n\n".encode()


def deepseek_ok(text="Risposta DeepSeek", *, reasoning=0, finish_reason="stop", usage=(11, 7, 0)):
    """A complete stream. Usage rides on the last chunk, as DeepSeek documents."""

    def respond(_request):
        def body():
            for _ in range(reasoning):
                yield _deepseek_chunk(reasoning="...")
            yield _deepseek_chunk(content=text)
            yield _deepseek_chunk(
                content="",
                finish_reason=finish_reason,
                usage={
                    "prompt_tokens": usage[0],
                    "completion_tokens": usage[1],
                    "total_tokens": usage[0] + usage[1],
                    "prompt_cache_hit_tokens": usage[2],
                    "prompt_cache_miss_tokens": usage[0] - usage[2],
                },
            )
            yield b"data: [DONE]\n\n"

        return _sse_response(body())

    return respond


def deepseek_drops_after(text="", *, reasoning=0):
    """The stream starts normally and then the connection breaks."""

    def respond(_request):
        def body():
            for _ in range(reasoning):
                yield _deepseek_chunk(reasoning="...")
            if text:
                yield _deepseek_chunk(content=text)
            raise httpx2.RemoteProtocolError("peer closed connection")

        return _sse_response(body())

    return respond


def deepseek_ends_silently(text=""):
    """The stream closes cleanly with no finish_reason: an incomplete reply."""

    def respond(_request):
        def body():
            if text:
                yield _deepseek_chunk(content=text)
            yield b"data: [DONE]\n\n"

        return _sse_response(body())

    return respond


def fails_with_status(status, message="provider unavailable"):
    return lambda _request: httpx2.Response(status, json={"error": {"message": message, "type": "fake"}})


def raises(exc):
    def respond(_request):
        raise exc

    return respond


def anthropic_ok(text="Risposta Claude", *, stop_reason="end_turn", input_tokens=13, output_tokens=5):
    def respond(_request):
        events = [
            {"type": "message_start", "message": {
                "id": "msg_1", "type": "message", "role": "assistant", "model": "fake", "content": [],
                "stop_reason": None, "stop_sequence": None,
                "usage": {"input_tokens": input_tokens, "output_tokens": 1},
            }},
            {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}},
            {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": text}},
            {"type": "content_block_stop", "index": 0},
            {"type": "message_delta", "delta": {"stop_reason": stop_reason, "stop_sequence": None},
             "usage": {"output_tokens": output_tokens}},
            {"type": "message_stop"},
        ]
        return _sse_response(iter(
            f"event: {event['type']}\ndata: {json.dumps(event)}\n\n".encode() for event in events
        ))

    return respond


class FakeProviders:
    def __init__(self):
        self.deepseek = FakeProvider("deepseek")
        self.anthropic = FakeProvider("anthropic")
        self.nous = FakeProvider("nous")


@pytest.fixture
def providers(monkeypatch):
    """DeepSeek and Anthropic configured. Each test scripts `.deepseek` and `.anthropic`."""
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-deepseek")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-anthropic")
    for variable in (
        "NOUS_API_KEY", "PLT_FALLBACK_MODEL", "PLT_FALLBACK_MAX_TOKENS",
        "DEEPSEEK_DEFAULT_MODEL", "DEEPSEEK_PRO_MODEL", "PLT_PROMPT_LOG",
    ):
        monkeypatch.delenv(variable, raising=False)
    fakes = FakeProviders()
    monkeypatch.setattr(ai_service, "_get_nous_client", lambda: anthropic.Anthropic(
        api_key="test",
        base_url="https://nous.test",
        max_retries=0,
        http_client=httpx2.Client(transport=httpx2.MockTransport(fakes.nous)),
    ))
    monkeypatch.setattr(ai_service, "_get_openai_client", lambda: openai.OpenAI(
        api_key="test",
        base_url="https://deepseek.test",
        max_retries=0,
        http_client=httpx2.Client(transport=httpx2.MockTransport(fakes.deepseek)),
    ))
    monkeypatch.setattr(ai_service, "_get_anthropic_client", lambda: anthropic.Anthropic(
        api_key="test",
        base_url="https://anthropic.test",
        max_retries=0,
        http_client=httpx2.Client(transport=httpx2.MockTransport(fakes.anthropic)),
    ))
    return fakes


@pytest.fixture
def events():
    """Every telemetry event emitted during the test."""
    received = []
    llm_telemetry.add_sink(received.append)
    yield received
    llm_telemetry.remove_sink(received.append)


def analysis_json(**overrides):
    """A minimal analysis that passes the CaseAnalysis schema."""
    data = {
        "case_id": "rossi", "case_title": "Rossi", "language": "it", "case_summary": "Sintesi",
        "materials": [], "timeline": [], "people": [], "evidence": [], "open_questions": [],
        "missing_documents": [], "contradictions": [], "procedural_deadlines": [],
        "brief_markdown": "", "legal_analysis": None,
    }
    data.update(overrides)
    return json.dumps(data)
