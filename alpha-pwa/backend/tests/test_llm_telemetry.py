"""LLM telemetry: what is recorded, and that case content never is."""

import json
import logging
import time
from dataclasses import asdict
from datetime import datetime, timezone

import pytest
from conftest import (
    analysis_json,
    anthropic_ok,
    deepseek_drops_after,
    deepseek_ok,
    fails_with_status,
)
from fastapi.testclient import TestClient

from app import ai_service, llm_telemetry
from app.ai_service import LLMCallFailed, analyze_case, stream_chat
from app.llm_telemetry import classify_error, estimate_cost_usd
from app.main import app
from app.models import AnalyzeRequest, ChatRequest

CANARY = "CANARYxSEGRETOxFASCICOLO"
OFF_PEAK = datetime(2026, 11, 7, 12, 0, tzinfo=timezone.utc)  # Saturday
PEAK = datetime(2026, 11, 6, 8, 0, tzinfo=timezone.utc)  # Friday, 08:00 UTC


def analyze_request(mode="flash"):
    return AnalyzeRequest(
        case_title="Rossi",
        materials=[{"name": "Verbale", "kind": "text", "text": "notifica del 12/03"}],
        mode=mode,
    )


def chat_request():
    return ChatRequest(messages=[{"role": "user", "content": "Domanda"}])


# ── What each record holds ───────────────────────────────────────────────────


def test_successful_call_records_all_requested_fields(providers, events):
    providers.deepseek.respond = deepseek_ok(analysis_json(), usage=(1000, 200, 400))

    analyze_case(analyze_request())

    record = events[0]
    assert record.event == "llm_call"
    assert record.provider == "deepseek"
    assert record.model == "deepseek-v4-flash"
    assert record.mode == "flash"
    assert record.status == "ok"
    assert record.latency_ms >= 0
    assert record.first_token_ms is not None
    assert record.input_tokens == 1000
    assert record.output_tokens == 200
    assert record.cached_input_tokens == 400
    assert record.estimated_cost_usd > 0
    assert record.finish_reason == "stop"
    assert (record.attempt, record.is_failover) == (1, False)
    assert (record.error_kind, record.error_type, record.http_status) == (None, None, None)


def test_failover_records_both_attempts_and_the_switch(providers, events):
    providers.deepseek.respond = fails_with_status(429)
    providers.anthropic.respond = anthropic_ok(analysis_json(), input_tokens=500, output_tokens=100)

    analyze_case(analyze_request())

    failed, switch, served = events
    assert (failed.provider, failed.status, failed.error_kind, failed.error_type, failed.http_status) == (
        "deepseek", "error", "rate_limit", "RateLimitError", 429,
    )
    assert failed.estimated_cost_usd is None
    assert (switch.event, switch.outcome, switch.reason, switch.http_status) == ("llm_failover", "switched", "rate_limit", 429)
    assert (served.provider, served.attempt, served.is_failover, served.status) == ("anthropic", 2, True, "ok")
    assert served.estimated_cost_usd == pytest.approx((500 * 1.00 + 100 * 5.00) / 1_000_000)
    assert failed.call_id == switch.call_id == served.call_id


def test_each_logical_call_gets_its_own_call_id(providers, events):
    providers.deepseek.respond = deepseek_ok(analysis_json())

    analyze_case(analyze_request())
    analyze_case(analyze_request())

    assert events[0].call_id != events[1].call_id


def test_client_disconnect_is_recorded_as_cancelled_not_as_an_outage(providers, events):
    providers.deepseek.respond = deepseek_ok("Prima parte")

    stream = stream_chat(chat_request())
    next(stream)
    stream.close()

    assert [(e.event, e.status) for e in events] == [("llm_call", "cancelled")]
    assert providers.anthropic.requests == []


def test_midstream_failure_records_the_error_and_skip(providers, events):
    providers.deepseek.respond = deepseek_drops_after("Prima parte")

    with pytest.raises(LLMCallFailed):
        list(stream_chat(chat_request()))

    record, skipped = events
    assert (record.status, record.error_kind, record.first_token_ms is not None) == ("error", "connection", True)
    assert skipped.skip_reason == "text_already_streamed"


# ── Cost estimate ────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("model", "at", "expected"),
    [
        ("deepseek-v4-flash", OFF_PEAK, 0.15 + 0.60),
        ("deepseek-flash", OFF_PEAK, 0.15 + 0.60),
        ("deepseek-v4-flash", PEAK, 0.30 + 1.20),
        ("deepseek-v4-pro", OFF_PEAK, 0.66 + 1.98),
        ("deepseek-v4-pro", PEAK, 1.32 + 3.96),
        ("claude-haiku-4-5-20251001", PEAK, 1.00 + 5.00),
        ("claude-opus-4-7", OFF_PEAK, 5.00 + 25.00),
    ],
)
def test_cost_per_million_tokens(model, at, expected):
    assert estimate_cost_usd(model, 1_000_000, 1_000_000, at=at) == pytest.approx(expected)


def test_cached_input_is_priced_at_the_cache_hit_rate():
    cost = estimate_cost_usd("deepseek-v4-flash", 1_000_000, 0, cached_input_tokens=1_000_000, at=OFF_PEAK)
    assert cost == pytest.approx(0.003)


@pytest.mark.parametrize(
    ("model", "input_tokens", "output_tokens"),
    [("some-future-model", 10, 10), ("deepseek-v4-flash", None, 10), ("deepseek-v4-flash", 10, None)],
)
def test_unknown_cost_is_none_rather_than_a_guess(model, input_tokens, output_tokens):
    assert estimate_cost_usd(model, input_tokens, output_tokens) is None


# ── Sinks: the tracing hook ──────────────────────────────────────────────────


def test_registered_sink_receives_every_event(providers):
    received = []
    llm_telemetry.add_sink(received.append)
    try:
        providers.deepseek.respond = fails_with_status(500)
        providers.anthropic.respond = anthropic_ok(analysis_json())
        analyze_case(analyze_request())
    finally:
        llm_telemetry.remove_sink(received.append)

    assert [e.event for e in received] == ["llm_call", "llm_failover", "llm_call"]


def test_failing_sink_never_breaks_a_call(providers, caplog):
    def broken_sink(_event):
        raise RuntimeError(f"backend down {CANARY}")

    llm_telemetry.add_sink(broken_sink)
    try:
        providers.deepseek.respond = deepseek_ok(analysis_json())
        with caplog.at_level(logging.INFO):
            result = analyze_case(analyze_request())
    finally:
        llm_telemetry.remove_sink(broken_sink)

    assert result.case_title == "Rossi"
    assert "telemetry sink failed: RuntimeError" in caplog.text
    assert CANARY not in caplog.text


def test_default_sink_writes_one_json_object_per_log_line(providers, caplog):
    providers.deepseek.respond = fails_with_status(429)
    providers.anthropic.respond = anthropic_ok(analysis_json())

    with caplog.at_level(logging.INFO, logger="plt.llm"):
        analyze_case(analyze_request())

    lines = [r for r in caplog.records if r.name == "plt.llm"]
    payloads = [json.loads(r.getMessage()) for r in lines]
    assert [p["event"] for p in payloads] == ["llm_call", "llm_failover", "llm_call"]
    assert payloads[2]["provider"] == "anthropic" and payloads[2]["status"] == "ok"
    assert [r.levelname for r in lines] == ["WARNING", "WARNING", "INFO"]


def test_classification_ignores_exception_messages():
    class RateLimitError(Exception):
        status_code = 429

    assert classify_error(RateLimitError(f"echo {CANARY}")) == ("rate_limit", "RateLimitError", 429)
    assert classify_error(ValueError(f"timeout {CANARY}")) == ("other", "ValueError", None)


# ── No case content in logs or telemetry ─────────────────────────────────────


def _sensitive_analysis_body(mode="flash"):
    return {
        "case_title": f"Caso {CANARY}",
        "materials": [{"name": f"Verbale {CANARY}", "kind": "text", "text": f"Testo {CANARY}"}],
        "mode": mode,
        "user_instructions": f"Istruzioni {CANARY}",
    }


def _assert_no_canary(caplog, events):
    assert caplog.records, "expected the flow to log something"
    assert CANARY not in caplog.text
    for event in events:
        assert CANARY not in json.dumps(asdict(event))


def _run_job(client, body):
    job_id = client.post("/api/analyze-jobs", json=body).json()["job_id"]
    deadline = time.time() + 5
    while time.time() < deadline:
        status = client.get(f"/api/analyze-jobs/{job_id}").json()["status"]
        if status != "running":
            return status
        time.sleep(0.02)
    raise AssertionError("job did not finish in time")


# Model output that reaches each logging branch of _finalize_analysis, all carrying
# the canary: not JSON, broken JSON, and JSON that fails schema validation.
BAD_MODEL_OUTPUTS = {
    "not-json": f"Mi dispiace, {CANARY}",
    "broken-json": '{"case_title": "' + CANARY + '", oops}',
    "schema-invalid": json.dumps({"case_id": CANARY, "timeline": CANARY}),
    "valid": analysis_json(case_summary=f"Sintesi {CANARY}"),
}


@pytest.mark.parametrize("output", BAD_MODEL_OUTPUTS.values(), ids=BAD_MODEL_OUTPUTS.keys())
@pytest.mark.parametrize("route", ["/api/analyze-text", "/api/analyze-jobs"])
def test_analysis_logs_no_case_content(providers, events, caplog, route, output):
    providers.deepseek.respond = fails_with_status(429, f"echo {CANARY}")
    providers.anthropic.respond = anthropic_ok(output)
    client = TestClient(app)

    with caplog.at_level(logging.INFO):
        if route == "/api/analyze-jobs":
            _run_job(client, _sensitive_analysis_body())
        else:
            client.post(route, json=_sensitive_analysis_body())

    _assert_no_canary(caplog, events)


def test_analysis_logs_no_case_content_when_every_provider_fails(providers, events, caplog):
    providers.deepseek.respond = fails_with_status(500, f"echo {CANARY}")
    providers.anthropic.respond = fails_with_status(500, f"echo {CANARY}")
    client = TestClient(app)

    with caplog.at_level(logging.INFO):
        assert _run_job(client, _sensitive_analysis_body()) == "error"
        client.post("/api/analyze-text", json=_sensitive_analysis_body())

    _assert_no_canary(caplog, events)


def test_chat_logs_no_case_content(providers, events, caplog):
    providers.deepseek.respond = fails_with_status(429, f"echo {CANARY}")
    providers.anthropic.respond = anthropic_ok(f"Risposta {CANARY}")
    body = {
        "messages": [{"role": "user", "content": f"Domanda {CANARY}"}],
        "system_override": f"Fascicolo {CANARY}",
    }

    with caplog.at_level(logging.INFO):
        response = TestClient(app).post("/api/chat", json=body)

    assert CANARY in response.text  # the lawyer still receives the answer
    _assert_no_canary(caplog, events)


def test_chat_logs_no_case_content_when_every_provider_fails(providers, events, caplog):
    providers.deepseek.respond = fails_with_status(500, f"echo {CANARY}")
    providers.anthropic.respond = fails_with_status(500, f"echo {CANARY}")
    request = ChatRequest(messages=[{"role": "user", "content": f"Domanda {CANARY}"}])

    with caplog.at_level(logging.INFO):
        with pytest.raises(LLMCallFailed) as caught:
            list(stream_chat(request))
        logging.getLogger("uvicorn.error").error("Exception in ASGI application", exc_info=caught.value)

    _assert_no_canary(caplog, events)


def test_prompt_log_is_off_unless_explicitly_enabled(providers, monkeypatch, tmp_path):
    log_path = tmp_path / "prompt_log.jsonl"
    monkeypatch.setattr(ai_service, "_PROMPT_LOG_PATH", log_path)
    providers.deepseek.respond = deepseek_ok(analysis_json())

    analyze_case(analyze_request())
    assert not log_path.exists()

    monkeypatch.setenv("PLT_PROMPT_LOG", "1")
    analyze_case(analyze_request())
    assert log_path.exists()
