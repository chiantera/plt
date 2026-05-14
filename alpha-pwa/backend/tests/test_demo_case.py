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
