"""Runtime provider failover: DeepSeek fails, Anthropic answers."""

import json
import time

import httpx2
import pytest
from conftest import (
    analysis_json,
    anthropic_ok,
    deepseek_drops_after,
    deepseek_ends_silently,
    deepseek_ok,
    fails_with_status,
    raises,
)
from fastapi.testclient import TestClient

from app import ai_service
from app.ai_service import LLMCallFailed, analyze_case, stream_analyze_case, stream_chat
from app.main import app
from app.models import AnalyzeRequest, ChatRequest

HAIKU = "claude-haiku-4-5-20251001"
OPUS = "claude-opus-4-7"
LANGUAGES = ["it", "en", "de"]
LOCALIZED_ANALYSIS_ERROR = {
    "it": "Analisi non riuscita. Riprova tra qualche secondo.",
    "en": "Analysis failed. Try again in a few seconds.",
    "de": "Die Analyse ist fehlgeschlagen. Versuchen Sie es in einigen Sekunden erneut.",
}


def analyze_request(mode="flash", language="it"):
    return AnalyzeRequest(
        case_title="Rossi",
        materials=[{"name": "Verbale", "kind": "text", "text": "notifica del 12/03"}],
        mode=mode,
        language=language,
    )


def chat_request(mode="flash", language="it", messages=None, **extra):
    return ChatRequest(
        messages=messages or [{"role": "user", "content": "Quali sono i termini?"}],
        mode=mode,
        language=language,
        **extra,
    )


def visible_text(frames):
    """Read frames the way the browser's SSE readers do (main.tsx, CaseDetailView.tsx).

    Those readers do `content + JSON.parse(payload).text`, so a data frame without a
    `text` key would render the word "undefined" in a lawyer's draft.
    """
    text = ""
    for frame in frames:
        for line in frame.split("\n"):
            if not line.startswith("data: "):
                continue
            payload = line[6:].strip()
            if payload == "[DONE]":
                return text
            text += json.loads(payload)["text"]
    return text


def calls(events):
    return [e for e in events if e.event == "llm_call"]


def failovers(events):
    return [e for e in events if e.event == "llm_failover"]


def analysis_events(body):
    return [
        json.loads(line[6:])
        for line in body.split("\n")
        if line.startswith("data: ") and line[6:].strip() != "[DONE]"
    ]


def poll_job(client, job_id, headers=None, timeout=5.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        body = client.get(f"/api/analyze-jobs/{job_id}", headers=headers or {}).json()
        if body["status"] != "running":
            return body
        time.sleep(0.02)
    raise AssertionError("job did not finish in time")


# ── Blocking analysis ────────────────────────────────────────────────────────


def test_blocking_analysis_uses_deepseek_when_healthy(providers, events):
    providers.deepseek.respond = deepseek_ok(analysis_json())

    result = analyze_case(analyze_request())

    assert result.usage_estimate.model_route == "deepseek-v4-flash"
    assert providers.anthropic.requests == []
    assert failovers(events) == []
    assert [(c.provider, c.status) for c in calls(events)] == [("deepseek", "ok")]


def test_blocking_analysis_fails_over_when_deepseek_is_rate_limited(providers, events):
    providers.deepseek.respond = fails_with_status(429)
    providers.anthropic.respond = anthropic_ok(analysis_json(case_title="Da Claude"))

    result = analyze_case(analyze_request())

    assert result.case_title == "Da Claude"
    assert result.usage_estimate.model_route == HAIKU
    assert [(c.provider, c.status, c.error_kind, c.http_status) for c in calls(events)] == [
        ("deepseek", "error", "rate_limit", 429),
        ("anthropic", "ok", None, None),
    ]
    switch = failovers(events)[0]
    assert (switch.outcome, switch.from_provider, switch.to_provider, switch.to_model) == (
        "switched", "deepseek", "anthropic", HAIKU,
    )
    assert len({e.call_id for e in events}) == 1


@pytest.mark.parametrize(
    ("deepseek_failure", "kind"),
    [
        (fails_with_status(429), "rate_limit"),
        (fails_with_status(500), "server"),
        (fails_with_status(503), "server"),
        (fails_with_status(401), "auth"),
        (fails_with_status(402), "billing"),
        (raises(httpx2.ConnectError("refused")), "connection"),
        (raises(httpx2.ReadTimeout("stalled")), "timeout"),
    ],
    ids=["429", "500", "503", "401", "402-no-balance", "connect-error", "read-timeout"],
)
def test_every_deepseek_failure_type_fails_over(providers, events, deepseek_failure, kind):
    providers.deepseek.respond = deepseek_failure
    providers.anthropic.respond = anthropic_ok(analysis_json())

    result = analyze_case(analyze_request())

    assert result.usage_estimate.model_route == HAIKU
    assert calls(events)[0].error_kind == kind


@pytest.mark.parametrize("finish_reason", ["insufficient_system_resource", "aborted"])
def test_inband_deepseek_failure_inside_http_200_fails_over(providers, events, finish_reason):
    providers.deepseek.respond = deepseek_ok(analysis_json(case_title="parziale"), finish_reason=finish_reason)
    providers.anthropic.respond = anthropic_ok(analysis_json(case_title="Da Claude"))

    assert analyze_case(analyze_request()).case_title == "Da Claude"
    assert calls(events)[0].finish_reason == finish_reason


def test_stream_closed_without_finish_reason_fails_over(providers):
    providers.deepseek.respond = deepseek_ends_silently('{"case_title": "tronc')
    providers.anthropic.respond = anthropic_ok(analysis_json(case_title="Da Claude"))

    assert analyze_case(analyze_request()).case_title == "Da Claude"


def test_buffered_analysis_discards_partial_text_when_deepseek_drops_mid_stream(providers):
    providers.deepseek.respond = deepseek_drops_after('{"case_title": "PARZIALE')
    providers.anthropic.respond = anthropic_ok(analysis_json(case_title="Da Claude"))

    assert analyze_case(analyze_request()).case_title == "Da Claude"


def test_both_providers_failing_raises_a_content_free_error(providers, events):
    providers.deepseek.respond = fails_with_status(429, "echo SEGRETO")
    providers.anthropic.respond = fails_with_status(500, "echo SEGRETO")

    with pytest.raises(LLMCallFailed) as caught:
        analyze_case(analyze_request())

    assert "SEGRETO" not in str(caught.value)
    assert caught.value.__suppress_context__ is True
    assert "deepseek=rate_limit/429" in str(caught.value)
    assert "anthropic=server/500" in str(caught.value)
    assert failovers(events)[-1].skip_reason == "no_further_provider"


# ── Background job path ──────────────────────────────────────────────────────


def test_background_job_fails_over_and_returns_result(providers, events):
    providers.deepseek.respond = fails_with_status(503)
    providers.anthropic.respond = anthropic_ok(analysis_json(case_title="Da Claude"))
    client = TestClient(app)

    job_id = client.post("/api/analyze-jobs", json=analyze_request().model_dump()).json()["job_id"]
    final = poll_job(client, job_id)

    assert final["status"] == "done"
    assert final["result"]["case_title"] == "Da Claude"
    assert final["result"]["usage_estimate"]["model_route"] == HAIKU
    assert {c.endpoint for c in calls(events)} == {"analyze_case"}


@pytest.mark.parametrize(
    ("accept_language", "language"),
    [("it-IT", "it"), ("en-GB", "en"), ("de-DE", "de")],
)
def test_background_job_error_stays_localized_when_both_providers_fail(providers, accept_language, language):
    providers.deepseek.respond = fails_with_status(503)
    providers.anthropic.respond = fails_with_status(503)
    client = TestClient(app)

    job_id = client.post("/api/analyze-jobs", json=analyze_request(language=language).model_dump()).json()["job_id"]
    final = poll_job(client, job_id, headers={"Accept-Language": accept_language})

    assert final["status"] == "error"
    assert final["error"] == LOCALIZED_ANALYSIS_ERROR[language]


# ── SSE analysis path ────────────────────────────────────────────────────────


def test_sse_analysis_fails_over_and_keeps_its_wire_format(providers):
    providers.deepseek.respond = deepseek_drops_after(reasoning=2)
    providers.anthropic.respond = anthropic_ok(analysis_json(case_title="Da Claude"))

    response = TestClient(app).post("/api/analyze-text", json=analyze_request().model_dump())

    assert response.status_code == 200
    assert ": ping" in response.text
    assert response.text.endswith("data: [DONE]\n\n")
    assert [e["status"] for e in analysis_events(response.text)] == ["done"]
    assert analysis_events(response.text)[0]["analysis"]["case_title"] == "Da Claude"


@pytest.mark.parametrize("language", LANGUAGES)
def test_sse_analysis_error_stays_localized_when_both_providers_fail(providers, language):
    providers.deepseek.respond = fails_with_status(500)
    providers.anthropic.respond = fails_with_status(500)

    frames = list(stream_analyze_case(analyze_request(language=language)))

    assert frames[-1] == "data: [DONE]\n\n"
    error = json.loads(frames[-2][6:])
    assert error == {"status": "error", "detail": LOCALIZED_ANALYSIS_ERROR[language]}


@pytest.mark.parametrize("language", LANGUAGES)
def test_analysis_failover_keeps_the_requested_output_language(providers, language):
    providers.deepseek.respond = fails_with_status(429)
    providers.anthropic.respond = anthropic_ok(analysis_json(language=language))

    result = analyze_case(analyze_request(language=language))

    assert result.language == language
    prompt = providers.anthropic.requests[0]["messages"][0]["content"]
    assert f"Lingua output: {language}" in prompt


# ── Chat streaming ───────────────────────────────────────────────────────────


def test_chat_uses_deepseek_when_healthy_and_requests_usage(providers, events):
    providers.deepseek.respond = deepseek_ok("Buongiorno")

    frames = list(stream_chat(chat_request()))

    assert visible_text(frames) == "Buongiorno"
    assert frames[-1] == "data: [DONE]\n\n"
    assert providers.anthropic.requests == []
    assert providers.deepseek.requests[0]["stream_options"] == {"include_usage": True}
    assert calls(events)[0].output_tokens == 7


def test_chat_fails_over_before_first_token(providers, events):
    providers.deepseek.respond = fails_with_status(429)
    providers.anthropic.respond = anthropic_ok("Risposta da Claude")

    frames = list(stream_chat(chat_request()))

    assert visible_text(frames) == "Risposta da Claude"
    assert frames[-1] == "data: [DONE]\n\n"
    assert failovers(events)[0].outcome == "switched"


def test_chat_fails_over_during_reasoning_because_no_text_was_shown(providers, events):
    providers.deepseek.respond = deepseek_drops_after(reasoning=3)
    providers.anthropic.respond = anthropic_ok("Risposta da Claude")

    frames = list(stream_chat(chat_request()))

    assert frames.count(": ping\n\n") >= 3
    assert visible_text(frames) == "Risposta da Claude"
    assert failovers(events)[0].outcome == "switched"


def test_chat_never_splices_providers_after_text_reached_the_client(providers, events):
    """A broken stream is the frontend's only signal that a draft is incomplete.

    `fetchChatFull` rejects on a broken stream. A graceful [DONE] here would save a
    truncated legal draft as if it were finished.
    """
    providers.deepseek.respond = deepseek_drops_after("Prima parte")

    frames = []
    with pytest.raises(LLMCallFailed):
        for frame in stream_chat(chat_request()):
            frames.append(frame)

    assert visible_text(frames) == "Prima parte"
    assert "data: [DONE]\n\n" not in frames
    assert providers.anthropic.requests == []
    skipped = failovers(events)[0]
    assert (skipped.outcome, skipped.skip_reason) == ("skipped", "text_already_streamed")


def test_chat_with_every_provider_down_raises_rather_than_sending_a_fake_reply(providers):
    providers.deepseek.respond = fails_with_status(500)
    providers.anthropic.respond = fails_with_status(500)

    frames = []
    with pytest.raises(LLMCallFailed):
        for frame in stream_chat(chat_request()):
            frames.append(frame)

    assert visible_text(frames) == ""


@pytest.mark.parametrize(
    ("language", "reply"),
    [
        ("it", "Il termine è perentorio: più di così non si può."),
        ("en", "The deadline is mandatory."),
        ("de", "Die Frist läuft für die Verteidigung ab, außerdem gilt: prüfen."),
    ],
)
def test_chat_failover_over_http_keeps_language_and_wire_format(providers, language, reply):
    providers.deepseek.respond = fails_with_status(503)
    providers.anthropic.respond = anthropic_ok(reply)

    response = TestClient(app).post("/api/chat", json=chat_request(language=language).model_dump())

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert visible_text([response.text]) == reply
    assert response.text.endswith("data: [DONE]\n\n")
    assert f"lingua di fallback dell'interfaccia: {language}" in providers.anthropic.requests[0]["system"]


def test_chat_failover_cleans_history_shapes_the_messages_api_rejects(providers):
    providers.deepseek.respond = fails_with_status(429)
    providers.anthropic.respond = anthropic_ok("ok")
    history = [
        {"role": "assistant", "content": "Benvenuto"},
        {"role": "user", "content": "Prima domanda"},
        {"role": "assistant", "content": ""},
        {"role": "user", "content": "Seconda domanda"},
    ]

    list(stream_chat(chat_request(messages=history)))

    assert providers.anthropic.requests[0]["messages"] == [
        {"role": "user", "content": "Prima domanda"},
        {"role": "user", "content": "Seconda domanda"},
    ]
    assert len(providers.deepseek.requests[0]["messages"]) == 5  # system + untouched history


# ── Routing is unchanged ─────────────────────────────────────────────────────


@pytest.mark.parametrize(("mode", "model"), [("flash", HAIKU), ("pro", OPUS)])
def test_failover_stays_on_the_same_tier(providers, mode, model):
    providers.deepseek.respond = fails_with_status(500)
    providers.anthropic.respond = anthropic_ok(analysis_json())

    result = analyze_case(analyze_request(mode=mode))

    assert providers.anthropic.requests[0]["model"] == model
    assert result.usage_estimate.model_route == model
    assert result.usage_estimate.pro_used is (mode == "pro")


def test_flash_failover_does_not_run_or_charge_for_pro(providers):
    providers.deepseek.respond = fails_with_status(500)
    providers.anthropic.respond = anthropic_ok(analysis_json(
        contradictions=[{"title": "Versioni", "description": "Contrasto"}],
    ))

    result = analyze_case(analyze_request(mode="flash"))

    assert result.usage_estimate.pro_used is False
    assert result.pro_recommendation.recommended is True
    assert result.pro_recommendation.requires_confirmation is True
    assert result.pro_recommendation.auto_charge is False
    assert [r["model"] for r in providers.anthropic.requests] == [HAIKU]


@pytest.mark.parametrize(
    ("mode", "expected_max_tokens"),
    [("flash", 64000), ("pro", 128000)],
)
def test_anthropic_failover_streams_and_respects_model_output_limits(providers, monkeypatch, mode, expected_max_tokens):
    """DeepSeek-sized budgets would be rejected by Claude, and by the SDK when not streaming."""
    monkeypatch.setattr(ai_service, "_FLASH_MAX_TOKENS", 128000)
    monkeypatch.setattr(ai_service, "_PRO_MAX_TOKENS", 256000)
    providers.deepseek.respond = fails_with_status(500)
    providers.anthropic.respond = anthropic_ok(analysis_json())

    analyze_case(analyze_request(mode=mode))

    body = providers.anthropic.requests[0]
    assert body["max_tokens"] == expected_max_tokens
    assert body["stream"] is True
    assert providers.deepseek.requests[0]["max_tokens"] == (128000 if mode == "flash" else 256000)


def test_anthropic_truncation_uses_the_existing_json_repair_path(providers):
    providers.deepseek.respond = fails_with_status(500)
    truncated = analysis_json(usage_estimate={"pages": 1})[:-1] + ', "people": [{"name": "tronc'
    providers.anthropic.respond = anthropic_ok(truncated, stop_reason="max_tokens")

    result = analyze_case(analyze_request())

    assert result.case_title == "Rossi"


def test_anthropic_alone_still_serves_when_it_holds_the_only_key(providers, monkeypatch, events):
    monkeypatch.delenv("DEEPSEEK_API_KEY")
    providers.anthropic.respond = anthropic_ok(analysis_json())

    result = analyze_case(analyze_request())

    assert result.usage_estimate.model_route == HAIKU
    assert providers.deepseek.requests == []
    assert failovers(events) == []


def test_no_failover_without_an_anthropic_key(providers, monkeypatch, events):
    monkeypatch.delenv("ANTHROPIC_API_KEY")
    providers.deepseek.respond = fails_with_status(429)

    with pytest.raises(LLMCallFailed):
        analyze_case(analyze_request())

    assert providers.anthropic.requests == []
    assert failovers(events)[0].skip_reason == "no_further_provider"


def test_real_clients_bound_stalls_and_retries(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "x")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "x")
    for variable in ("PLT_LLM_READ_TIMEOUT_SECONDS", "PLT_LLM_CONNECT_TIMEOUT_SECONDS", "PLT_LLM_MAX_RETRIES"):
        monkeypatch.delenv(variable, raising=False)

    for client in (ai_service._get_openai_client(), ai_service._get_anthropic_client()):
        assert client.timeout.read == 120
        assert client.timeout.connect == 10
        assert client.max_retries == 1

    monkeypatch.setenv("PLT_LLM_READ_TIMEOUT_SECONDS", "30")
    monkeypatch.setenv("PLT_LLM_MAX_RETRIES", "0")
    assert ai_service._get_openai_client().timeout.read == 30
    assert ai_service._get_anthropic_client().max_retries == 0
