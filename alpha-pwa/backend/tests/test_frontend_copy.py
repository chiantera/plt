from pathlib import Path


SRC = Path(__file__).resolve().parents[2] / "frontend" / "src"
STYLES = SRC / "styles.css"


def _frontend_source() -> str:
    """The UI was split across files (app shell + case workspace + upload drawer).
    Scan the combined source so these checks survive component extraction."""
    files = [
        SRC / "main.tsx",
        SRC / "screens" / "CaseDetailView.tsx",
        SRC / "components" / "MultiFileUploadDrawer.tsx",
    ]
    return "\n".join(f.read_text() for f in files)


def test_mobile_navigation_uses_product_language_not_raw_model_names():
    source = _frontend_source()

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
    source = _frontend_source()
    styles = STYLES.read_text()

    # Home stats wired; case tabs switchable
    assert "className=\"home-stats\"" in source
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
