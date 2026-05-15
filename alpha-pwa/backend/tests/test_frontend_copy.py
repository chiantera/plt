from pathlib import Path


FRONTEND = Path(__file__).resolve().parents[2] / "frontend" / "src" / "main.tsx"
STYLES = Path(__file__).resolve().parents[2] / "frontend" / "src" / "styles.css"


def test_mobile_navigation_uses_product_language_not_raw_model_names():
    source = FRONTEND.read_text()

    # Tab labels present
    assert "label: 'Cronologia'" in source
    assert "label: 'Agenda'" in source
    assert "label: 'Analisi legale'" in source

    # No raw DeepSeek model names exposed to users
    assert "deepseek-v4-flash" not in source

    # Key UI copy
    assert "Prossima priorità" in source
    assert "<span>priorità</span>" in source
    assert "<span>prossima</span>" not in source

    # Legal analysis features present
    assert "LegalAnalysis" in source
    assert "evidence_balance" in source
    assert "witness_assessments" in source


def test_dashboard_cards_and_navigation_links_are_wired():
    source = FRONTEND.read_text()
    styles = STYLES.read_text()

    # Stats cards still wired to navigation
    assert "className=\"stats-card\"" in source
    assert "setActiveTab" in source

    # Cases list view present
    assert "CaseListView" in source
    assert "CaseDetailView" in source

    # Upload flow present
    assert "UploadDrawer" in source
    assert "/api/analyze-text" in source
    assert "/api/upload" in source

    # Risk level coloring present
    assert "riskColor" in source
    assert "riskLabel" in source

    # Key CSS classes
    assert ".case-card" in styles
    assert ".risk-banner" in styles
    assert ".charge-card" in styles
    assert ".strategy-card" in styles
    assert ".witness-card" in styles
    assert ".strength-bar-fill" in styles
