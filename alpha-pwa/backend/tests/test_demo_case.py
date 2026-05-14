from fastapi.testclient import TestClient

from app.main import app


def test_demo_case_analysis_is_italian_and_source_linked():
    client = TestClient(app)

    response = client.get("/api/demo-case")

    assert response.status_code == 200
    payload = response.json()
    assert "Furto aggravato" in payload["case_title"]
    assert "udienza" in payload["case_summary"].lower() or "furto" in payload["case_summary"].lower()
    assert payload["language"] == "it"

    assert len(payload["materials"]) >= 4
    material_names = {item["name"] for item in payload["materials"]}
    assert "verbale_arresto.txt" in material_names
    assert "nota_cliente.txt" in material_names

    assert len(payload["timeline"]) >= 4
    first_event = payload["timeline"][0]
    assert first_event["date"] == "2026-04-18"
    assert first_event["source_refs"]
    assert first_event["source_refs"][0]["quote"]

    assert any("contradd" in item["title"].lower() for item in payload["contradictions"])
    assert any("testimone" in item["question"].lower() for item in payload["open_questions"])
    assert len(payload["brief_markdown"]) > 100


def test_usage_estimate_exposes_flash_first_model_route():
    client = TestClient(app)

    payload = client.get("/api/demo-case").json()
    usage = payload["usage_estimate"]

    assert usage["model_route"]  # non-empty (Anthropic or DeepSeek model name)
    assert usage["pro_used"] is False
    assert usage["pages"] >= 4
    assert usage["flash_input_tokens"] > 0
    assert usage["flash_output_tokens"] > 0


def test_demo_case_exposes_procedural_deadlines_and_workback_schedule():
    client = TestClient(app)

    payload = client.get("/api/demo-case").json()
    deadlines = payload["procedural_deadlines"]

    assert len(deadlines) >= 2
    hearing = deadlines[0]
    assert hearing["deadline_type"] == "hearing"
    assert hearing["status"] == "confirmed"
    assert hearing["due_date"] == "2026-04-20"
    assert hearing["due_time"] == "09:30"
    assert hearing["source_refs"][0]["source_name"] == "avviso_udienza.txt"

    brief = next(item for item in deadlines if item["deadline_type"] == "defense_brief")
    assert brief["status"] == "candidate"
    assert brief["start_work_date"] == "2026-05-15"
    assert brief["internal_target_date"] == "2026-05-29"
    assert any("contraddizione" in task.lower() or "alibi" in task.lower() for task in brief["tasks"])
    assert brief["source_refs"]


def test_cases_list_endpoint_returns_summaries():
    client = TestClient(app)

    response = client.get("/api/cases")
    assert response.status_code == 200
    cases = response.json()
    assert len(cases) >= 2
    for case in cases:
        assert "case_id" in case
        assert "case_title" in case
        assert "risk_level" in case


def test_case_detail_endpoint_returns_legal_analysis():
    client = TestClient(app)

    response = client.get("/api/cases/demo-furto-aggravato-roma-2026")
    assert response.status_code == 200
    payload = response.json()
    assert payload["legal_analysis"] is not None
    la = payload["legal_analysis"]
    assert la["risk_level"] in ("low", "medium", "high", "critical")
    assert len(la["charges"]) >= 2
    assert len(la["strategies"]) >= 2
    assert len(la["immediate_actions"]) >= 3
    assert la["evidence_balance"]["prosecution_strength"] > 0
    assert la["client_summary"]
