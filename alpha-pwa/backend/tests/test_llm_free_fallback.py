"""Failover from DeepSeek to a free model on Nous Portal."""

import json
import time

import pytest
from conftest import analysis_json, anthropic_ok, deepseek_drops_after, fails_with_status
from fastapi.testclient import TestClient

from app import ai_service
from app.ai_service import LLMCallFailed, analyze_case, stream_chat
from app.llm_telemetry import estimate_cost_usd
from app.main import app
from app.models import AnalyzeRequest, ChatRequest

FREE_MODEL = "meituan/longcat-2.5:free"


@pytest.fixture
def free_fallback(providers, monkeypatch):
    """DeepSeek primary and Nous as the only fallback, as PLT is meant to run."""
    monkeypatch.delenv("ANTHROPIC_API_KEY")
    monkeypatch.setenv("NOUS_API_KEY", "test-nous")
    providers.deepseek.respond = fails_with_status(429)
    return providers


def analyze_request(mode="flash", language="it"):
    return AnalyzeRequest(
        case_title="Rossi",
        materials=[{"name": "Verbale", "kind": "text", "text": "notifica del 12/03"}],
        mode=mode,
        language=language,
    )


def chat_body(language="it"):
    return {"messages": [{"role": "user", "content": "Domanda"}], "language": language}


def test_blocking_analysis_fails_over_to_the_free_model(free_fallback, events):
    free_fallback.nous.respond = anthropic_ok(analysis_json(case_title="Dal modello gratuito"))

    result = analyze_case(analyze_request())

    assert result.case_title == "Dal modello gratuito"
    assert result.usage_estimate.model_route == FREE_MODEL
    assert free_fallback.nous.requests[0]["model"] == FREE_MODEL
    assert free_fallback.nous.requests[0]["stream"] is True
    failed, switch, served = events
    assert (failed.provider, failed.error_kind) == ("deepseek", "rate_limit")
    assert (switch.outcome, switch.to_provider, switch.to_model) == ("switched", "nous", FREE_MODEL)
    assert (served.provider, served.status, served.estimated_cost_usd) == ("nous", "ok", 0.0)
    assert (served.input_tokens, served.output_tokens) == (13, 5)


def test_background_job_fails_over_to_the_free_model(free_fallback):
    free_fallback.nous.respond = anthropic_ok(analysis_json())
    client = TestClient(app)

    job_id = client.post("/api/analyze-jobs", json=analyze_request().model_dump()).json()["job_id"]
    deadline = time.time() + 5
    body = {"status": "running"}
    while body["status"] == "running" and time.time() < deadline:
        body = client.get(f"/api/analyze-jobs/{job_id}").json()
        time.sleep(0.02)

    assert body["status"] == "done"
    assert body["result"]["usage_estimate"]["model_route"] == FREE_MODEL


def test_sse_analysis_fails_over_to_the_free_model(free_fallback):
    free_fallback.deepseek.respond = deepseek_drops_after(reasoning=1)
    free_fallback.nous.respond = anthropic_ok(analysis_json())

    response = TestClient(app).post("/api/analyze-text", json=analyze_request().model_dump())

    assert '"status": "done"' in response.text
    assert response.text.endswith("data: [DONE]\n\n")


@pytest.mark.parametrize("language", ["it", "en", "de"])
def test_chat_fails_over_to_the_free_model_in_each_language(free_fallback, language):
    free_fallback.nous.respond = anthropic_ok("Prüfung è ok")

    response = TestClient(app).post("/api/chat", json=chat_body(language))

    frames = [line[6:] for line in response.text.split("\n") if line.startswith("data: ")]
    assert frames[-1] == "[DONE]"
    assert "".join(json.loads(frame)["text"] for frame in frames[:-1]) == "Prüfung è ok"
    assert f"{language}." in free_fallback.nous.requests[0]["system"]


def test_chat_does_not_switch_after_text_reached_the_client(free_fallback, events):
    free_fallback.deepseek.respond = deepseek_drops_after("Prima parte")

    with pytest.raises(LLMCallFailed):
        list(stream_chat(ChatRequest(**chat_body())))

    assert free_fallback.nous.requests == []
    assert events[-1].skip_reason == "text_already_streamed"


def test_failover_never_starts_pro_on_any_provider(free_fallback):
    free_fallback.nous.respond = anthropic_ok(analysis_json(
        contradictions=[{"title": "Versioni", "description": "Contrasto"}],
    ))

    result = analyze_case(analyze_request(mode="flash"))

    assert result.usage_estimate.pro_used is False
    assert result.pro_recommendation.requires_confirmation is True
    assert result.pro_recommendation.auto_charge is False
    assert [r["model"] for r in free_fallback.deepseek.requests] == ["deepseek-v4-flash"]


def test_failover_is_off_without_a_nous_key(providers, monkeypatch, events):
    monkeypatch.delenv("ANTHROPIC_API_KEY")
    providers.deepseek.respond = fails_with_status(429)

    with pytest.raises(LLMCallFailed):
        analyze_case(analyze_request())

    assert providers.nous.requests == []
    assert events[-1].skip_reason == "no_further_provider"


def test_healthy_deepseek_never_touches_the_fallback(free_fallback):
    from conftest import deepseek_ok

    free_fallback.deepseek.respond = deepseek_ok(analysis_json())

    assert analyze_case(analyze_request()).usage_estimate.model_route == "deepseek-v4-flash"
    assert free_fallback.nous.requests == []


def test_anthropic_is_an_optional_step_after_the_free_model(free_fallback, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-anthropic")
    free_fallback.nous.respond = fails_with_status(503)
    free_fallback.anthropic.respond = anthropic_ok(analysis_json())

    result = analyze_case(analyze_request())

    assert result.usage_estimate.model_route == "claude-haiku-4-5-20251001"
    assert len(free_fallback.nous.requests) == 1


def test_fallback_model_and_budget_are_configurable(free_fallback, monkeypatch):
    monkeypatch.setenv("PLT_FALLBACK_MODEL", "other/model:free")
    monkeypatch.setenv("PLT_FALLBACK_MAX_TOKENS", "1000")
    free_fallback.nous.respond = anthropic_ok(analysis_json())

    analyze_case(analyze_request())

    assert free_fallback.nous.requests[0]["model"] == "other/model:free"
    assert free_fallback.nous.requests[0]["max_tokens"] == 1000


def test_default_budget_is_capped_for_the_free_model(free_fallback, monkeypatch):
    monkeypatch.setattr(ai_service, "_PRO_MAX_TOKENS", 256000)
    free_fallback.nous.respond = anthropic_ok(analysis_json())

    analyze_case(analyze_request(mode="pro"))

    assert free_fallback.nous.requests[0]["max_tokens"] == 64000


def test_real_nous_client_targets_the_portal(monkeypatch):
    monkeypatch.setenv("NOUS_API_KEY", "test-nous")

    client = ai_service._get_nous_client()

    assert client.base_url.host == "inference-api.nousresearch.com"
    assert client.max_retries == 1


def test_free_models_cost_nothing_and_missing_usage_stays_unknown():
    assert estimate_cost_usd(FREE_MODEL, 1000, 1000) == 0.0
    assert estimate_cost_usd(FREE_MODEL, None, 1000) is None
