from fastapi.testclient import TestClient

from app.main import app


def test_demo_case_analysis_is_italian_and_source_linked():
    client = TestClient(app)

    response = client.get("/api/demo-case")

    assert response.status_code == 200
    payload = response.json()
    assert payload["case_title"] == "Caso demo — Furto aggravato in concorso"
    assert "udienza" in payload["case_summary"].lower()
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
    assert "Punti da verificare" in payload["brief_markdown"]


def test_usage_estimate_exposes_flash_first_model_route():
    client = TestClient(app)

    payload = client.get("/api/demo-case").json()
    usage = payload["usage_estimate"]

    assert usage["model_route"] == "deepseek-v4-flash"
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
    assert brief["due_date"] == "2026-05-31"
    assert brief["start_work_date"] == "2026-05-15"
    assert brief["internal_target_date"] == "2026-05-29"
    assert any("contraddizione" in task.lower() for task in brief["tasks"])
    assert brief["source_refs"]
