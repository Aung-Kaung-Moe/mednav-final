"""Reproducible synthetic navigation benchmark. Not a clinical effectiveness study.

Run from backend/: python -m evaluation.bodygraph_v3 --output PATH
Always uses an ephemeral SQLite database, real API/engine, shared eligibility
gates and the existing Member 3 fixed/catalog-order comparator. No live DB input.
"""
import argparse
import json
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import create_app
from app.real_engine import EQUIPMENT
from vendor.member3_stable.engine.models import InvestigationRequest, InventoryItem, FIELDS
from vendor.member3_stable.engine.next_check import investigate_with_trace, usable_ids
from vendor.member3_stable.engine.compare import compare
from vendor.member3_stable.engine.rules import CATALOG

CASES = Path(__file__).with_name("bodygraph_cases.json")


def evaluate():
    fixture = json.loads(CASES.read_text(encoding="utf8"))
    results = []
    with tempfile.TemporaryDirectory(prefix="mednav-bodygraph-evaluation-") as directory:
        app = create_app(f"sqlite:///{(Path(directory) / 'evaluation.sqlite3').as_posix()}")
        with TestClient(app) as api:
            baseline = api.get("/api/v1/astronauts/Crew%20A").json()
            for case in fixture["cases"]:
                update = api.patch("/api/v1/inventory/Blood-pressure%20monitor", json={"quantity": case["quantity"], "available": case["available"]})
                assert update.status_code == 200
                response = api.post("/api/v1/check-ins", json={"astronaut_id": "Crew A", **{key: case[key] for key in ("hr", "sleep", "bp", "symptoms")}})
                assert response.status_code == 201
                saved = response.json()
                # A later record ensures both retrieval protocols must retrieve
                # the named historical ID, not silently substitute the latest.
                assert api.post("/api/v1/check-ins", json={"astronaut_id": "Crew A", "hr": 65, "sleep": 8, "bp": "120 / 80", "symptoms": ["Later synthetic history sentinel"]}).status_code == 201
                inventory = [InventoryItem(equipment_id=EQUIPMENT[row["name"]], quantity=row["quantity"], usable=row["available"])
                             for row in api.get("/api/v1/inventory").json() if row["name"] in EQUIPMENT]
                bp = list(map(int, saved["bp"].split(" / "))) if saved["bp"] is not None else [None, None]
                request = InvestigationRequest.model_validate({
                    "astronaut_id": saved["astronaut_id"], "observed_at": saved["recorded_at"], "symptoms": saved["symptoms"],
                    "measurements": dict(zip(FIELDS, [saved["hr"], saved["sleep"], *bp])),
                    "personal_baseline": {"resting_hr_bpm": baseline["baseline"], "sleep_hours": baseline["sleepBaseline"]},
                    "available_equipment": sorted(item.equipment_id for item in inventory if item.quantity > 0 and item.usable),
                    "communication_status": case["communication"], "emergency_override": case["override"], "dataset_type": "synthetic",
                })
                real = api.post("/api/v1/investigations/evaluate", json={"check_in_id": saved["id"], "communication_status": case["communication"], "emergency_override": case["override"]})
                assert real.status_code == 200
                trace = investigate_with_trace(request, inventory=inventory)
                assert real.json() == trace.response.model_dump(mode="json"), "Fixture/API engine request mapping diverged"
                expected_missing = {name for name in FIELDS if request.measurements[name] is None}
                paths = compare(request, case["target"], inventory=inventory)
                allowed = usable_ids(request, inventory)
                equipment = {check.id: set(check.equipment) for check in CATALOG}
                historical = api.get("/api/v1/astronauts/Crew%20A/history", params={"limit": 1000}).json()
                retrieved = {
                    "mednav": api.get(f"/api/v1/check-ins/{saved['id']}").json(),
                    "fixed_order": next(row for row in historical if row["id"] == saved["id"]),
                }
                metrics = {}
                for method in ("fixed_order", "mednav"):
                    path = paths[method]
                    event = api.post("/api/v1/follow-ups", json={"astronaut_id": "Crew A", "check_in_id": saved["id"], "event_type": "note_recorded",
                        "note": f"Synthetic software benchmark only: {case['id']} / {method}; navigation path {path}; target {case['target']}. No medical action or approval asserted."})
                    assert event.status_code == 201
                    stored = api.get("/api/v1/astronauts/Crew%20A/follow-ups", params={"check_in_id": saved["id"]}).json()
                    assert any(item["id"] == event.json()["id"] for item in stored)
                    reached = case["target"] is not None and case["target"] in path
                    metrics[method] = {
                        "missing_hits": len(set(trace.response.missing_data) & expected_missing), "missing_expected": len(expected_missing),
                        "missing_false_positives": len(set(trace.response.missing_data) - expected_missing),
                        "equipment_violations": sum(not equipment[item] <= allowed for item in path),
                        "override_correct": trace.response.status == "escalate" and trace.response.next_check is None and not path if case["override"] else None,
                        "history_retrieved": retrieved[method] == saved,
                        "permitted_form_openings": len(path), "target_reached": reached,
                        "steps_through_documentation": len(path) + 1 if reached else None,
                        "documentation_saved": True,
                    }
                results.append({"id": case["id"], "status": trace.response.status, "next_check": trace.response.next_check.id if trace.response.next_check else None,
                                "target": case["target"], "paths": paths, "metrics": metrics})
    summary = {}
    for method in ("fixed_order", "mednav"):
        rows = [row["metrics"][method] for row in results]
        reached = [row for row in rows if row["target_reached"]]
        overrides = [row for row in rows if row["override_correct"] is not None]
        summary[method] = {
            "missing_hits": sum(row["missing_hits"] for row in rows), "missing_expected": sum(row["missing_expected"] for row in rows),
            "missing_false_positives": sum(row["missing_false_positives"] for row in rows),
            "equipment_violations": sum(row["equipment_violations"] for row in rows),
            "correct_overrides": sum(row["override_correct"] for row in overrides), "overrides": len(overrides),
            "history_retrieved": sum(row["history_retrieved"] for row in rows), "history_cases": len(rows),
            "reachable_targets": len(reached), "targeted_cases": sum(row["target"] is not None for row in results),
            "permitted_form_openings_on_reachable": sum(row["permitted_form_openings"] for row in reached),
            "steps_through_documentation_on_reachable": sum(row["steps_through_documentation"] for row in reached),
            "documentation_events_saved": sum(row["documentation_saved"] for row in rows),
        }
    return {"dataset_type": "synthetic", "rules": "demo-2", "cases": results, "summary": summary,
            "limitations": ["Both methods deliberately share Member 3 missing-data, equipment and manual-escalation gates; equality there is expected.",
                "Fixed checklist uses eligible catalog order; MEDNAV uses the unchanged engine ordering. Targets are predeclared navigation probes, not medical recommendations.",
                "Step metric is permitted form openings plus one real documentation POST, not measured mouse clicks, elapsed crew time, or clinical benefit.",
                "Both methods have the same history access; direct-ID retrieval and list-scan both must retrieve the exact historical record.",
                "Only four approved engine numeric fields are scored; unsupported body-system measurements are not clinically evaluated.",
                "UUIDs/timestamps vary per run; scenario definitions and aggregate metrics are reproducible. Ephemeral DB is deleted after evaluation."]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = evaluate()
    encoded = json.dumps(result, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encoded, encoding="utf8")
    print(json.dumps(result["summary"], indent=2))
