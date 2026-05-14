from pathlib import Path


FRONTEND = Path(__file__).resolve().parents[2] / "frontend" / "src" / "main.tsx"
STYLES = Path(__file__).resolve().parents[2] / "frontend" / "src" / "styles.css"


def test_mobile_navigation_uses_product_language_not_raw_model_names():
    source = FRONTEND.read_text()

    assert "label: 'Cronologia'" in source
    assert "label: 'Agenda'" in source
    assert "deepseek-v4-flash" not in source
    assert "Analisi profonda" in source
    assert "Prossima priorità" in source
    assert "<span>priorità</span>" in source
    assert "<span>prossima</span>" not in source
    assert ".replace(' 2026', '')" not in source


def test_dashboard_cards_and_green_pill_are_internal_links():
    source = FRONTEND.read_text()
    styles = STYLES.read_text()

    assert "jumpToMaterials" in source
    assert "jumpToTimeline" in source
    assert "jumpToContradictions" in source
    assert "jumpToDeadlines" in source
    assert "className=\"stats-card\"" in source
    assert "className=\"pill action-pill\"" in source
    assert "sparkle-pulse" in styles
