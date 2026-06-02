import time

from fastapi.testclient import TestClient

from app import main
from app.main import app
from app.models import CaseAnalysis, UsageEstimate


def _fake_result() -> CaseAnalysis:
    return CaseAnalysis(
        case_id="rossi",
        case_title="Rossi",
        language="it",
        case_summary="Sintesi",
        materials=[],
        timeline=[],
        people=[],
        evidence=[],
        open_questions=[],
        missing_documents=[],
        contradictions=[],
        procedural_deadlines=[],
        brief_markdown="",
        usage_estimate=UsageEstimate(),
        legal_analysis=None,
    )


def _request_body():
    return {
        "case_title": "Rossi",
        "materials": [{"name": "Verbale", "kind": "text", "text": "notifica del 12/03"}],
        "mode": "flash",
        "language": "it",
    }


def _poll(client, job_id, timeout=3.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = client.get(f"/api/analyze-jobs/{job_id}")
        assert r.status_code == 200
        body = r.json()
        if body["status"] != "running":
            return body
        time.sleep(0.05)
    raise AssertionError("job did not finish in time")


def test_analysis_job_runs_in_background_and_returns_result(monkeypatch):
    monkeypatch.setattr(main, "analyze_case", lambda request: _fake_result())
    client = TestClient(app)

    created = client.post("/api/analyze-jobs", json=_request_body())
    assert created.status_code == 200
    job_id = created.json()["job_id"]
    assert created.json()["status"] == "running"

    final = _poll(client, job_id)
    assert final["status"] == "done"
    assert final["result"]["case_title"] == "Rossi"
    assert final["error"] is None


def test_analysis_job_surfaces_errors(monkeypatch):
    def boom(request):
        raise ValueError("modello non disponibile")

    monkeypatch.setattr(main, "analyze_case", boom)
    client = TestClient(app)

    job_id = client.post("/api/analyze-jobs", json=_request_body()).json()["job_id"]
    final = _poll(client, job_id)
    assert final["status"] == "error"
    assert "modello non disponibile" in final["error"]
    assert final["result"] is None


def test_unknown_job_returns_404():
    client = TestClient(app)
    assert client.get("/api/analyze-jobs/does-not-exist").status_code == 404
