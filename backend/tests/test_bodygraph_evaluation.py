from evaluation.bodygraph_v3 import evaluate


def test_synthetic_navigation_evaluation_is_reproducible_and_safely_paired():
    first, second = evaluate(), evaluate()
    assert first["dataset_type"] == "synthetic" and first["rules"] == "demo-2"
    assert first["summary"] == second["summary"]
    assert first["cases"] == second["cases"]
    for method in ("fixed_order", "mednav"):
        result = first["summary"][method]
        assert result["missing_hits"] == result["missing_expected"]
        assert result["missing_false_positives"] == result["equipment_violations"] == 0
        assert result["correct_overrides"] == result["overrides"] == 2
        assert result["history_retrieved"] == result["history_cases"] == 10
        assert result["documentation_events_saved"] == 10
    assert any(row["status"] == "insufficient_evidence" and row["next_check"] is None for row in first["cases"])
