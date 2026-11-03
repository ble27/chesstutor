"""PRD §7 evidence-to-template mapping; legal, independently checked boards."""

import chess
import pytest

from tests.unit.future_sprints.contracts import policy

# The plan requires recording unsupported coverage. These three concrete cases
# are an initial detector corpus, not a claim to cover every listed chess theme.
CASES = [
    ("hanging_piece", "6k1/8/8/3q4/2B5/8/8/6K1 w - - 0 1", ("c4d5",), {"c4", "d5"}),
    ("fork", "6k1/3r1q2/8/8/8/5N2/8/6K1 w - - 0 1", ("f3e5",), {"e5", "d7", "f7"}),
    ("pin", "4k3/4n3/8/8/8/8/8/4R1K1 w - - 0 1", (), {"e1", "e7", "e8"}),
]


@pytest.mark.parametrize(("kind", "fen", "line", "squares"), CASES)
def test_detector_fixtures_are_valid_and_continuations_are_legal(kind, fen, line, squares):
    board = chess.Board(fen)
    assert board.is_valid()
    for uci in line:
        move = chess.Move.from_uci(uci)
        assert move in board.legal_moves
        board.push(move)


@pytest.mark.parametrize(("kind", "fen", "line", "squares"), CASES)
def test_detectors_return_position_bound_evidence(kind, fen, line, squares):
    evidence = policy("services.core.coaching", "detect_evidence")(
        fen=fen,
        ply=1,
        continuation_uci=line,
    )
    matching = [item for item in evidence if item.kind == kind]
    assert matching
    assert any(squares <= set(item.squares) for item in matching)
    for item in matching:
        assert item.id
        assert item.ply == 1
        assert item.fen == fen


@pytest.mark.parametrize(
    "kind",
    [
        "hanging_piece",
        "fork",
        "pin",
        "skewer",
        "discovered_attack",
        "mate_threat",
        "development",
        "king_safety",
        "center_control",
        "pawn_structure",
        "piece_activity",
        "exchange",
        "endgame",
    ],
)
def test_supported_detector_uses_reviewed_template_or_explicitly_reports_unsupported(kind):
    result = policy("services.core.coaching", "template_for_evidence")(
        kind=kind,
        level="beginner",
    )
    assert result.status in {"supported", "unsupported"}
    if kind in {"hanging_piece", "fork", "pin"}:
        assert result.status == "supported"
    if result.status == "supported":
        assert result.template_id
        assert result.reviewed is True
    else:
        assert result.template_id is None
        assert result.reason
