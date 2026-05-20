from app.models import DefenseStrategy, ProceduralDeadline


def test_procedural_deadline_tracks_feriale_application_with_safe_default():
    deadline = ProceduralDeadline(title="Termine memoria")

    assert deadline.feriale_applied is False
    assert deadline.model_dump()["feriale_applied"] is False


def test_defense_strategy_can_link_to_specific_charge():
    strategy = DefenseStrategy(
        title="Nullità notifica",
        target_charge_id="Capo A",
        strategy_type="procedural",
        priority="primary",
        description="Collega il motivo al capo contestato.",
        strengths=[],
        risks=[],
        required_evidence=[],
    )

    assert strategy.target_charge_id == "Capo A"
