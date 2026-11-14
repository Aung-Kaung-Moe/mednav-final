from fastapi.testclient import TestClient
import pytest

from app.main import create_app


@pytest.fixture
def client(tmp_path):
    db_file = tmp_path / "iterative.db"
    with TestClient(create_app(f"sqlite:///{db_file.as_posix()}", investigation_mode="real")) as c:
        yield c


def test_mission_context_defaults_and_manual_med_update(client):
    res = client.get("/api/v1/investigation/mission-context")
    assert res.status_code == 200
    data = res.json()
    assert data["crew_count"] == 4
    assert data["remaining_days"] == 45
    assert len(data["medications"]) == 6

    patch = client.patch(
        "/api/v1/investigation/mission-context",
        json={"crew_count": 6, "remaining_days": 90, "medications": [{"id": "acetaminophen_500mg", "quantity": 10}]},
    )
    assert patch.status_code == 200
    updated = patch.json()
    assert updated["crew_count"] == 6
    assert updated["remaining_days"] == 90
    acet = next(m for m in updated["medications"] if m["id"] == "acetaminophen_500mg")
    assert acet["quantity"] == 10


def test_fast_post_exercise_elimination_skips_medication(client):
    ci = client.post(
        "/api/v1/check-ins",
        json={"astronaut_id": "Crew B", "hr": 112, "sleep": 7.2, "bp": None, "symptoms": []},
    ).json()

    start = client.post("/api/v1/investigation/sessions", json={"astronaut_id": "Crew B", "check_in_id": ci["id"]})
    assert start.status_code == 201
    s = start.json()
    assert s["status"] == "in_progress"
    assert s["current_question"]["id"] == "recent_exercise"

    s = client.post(
        f"/api/v1/investigation/sessions/{s['id']}/answer",
        json={"question_id": "recent_exercise", "answer_value": "yes"},
    ).json()
    assert s["status"] == "completed"
    assert "Workout" in s["assessment_title"]
    assert s["medication_allocation"]["rationing_mode"] == "non_pharmacologic"
    assert s["medication_allocation"]["recommended_total_units"] == 0


def test_iterative_narrowing_and_mission_rationing_by_crew_days_and_stock(client):
    client.patch(
        "/api/v1/investigation/mission-context",
        json={
            "crew_count": 5,
            "remaining_days": 60,
            "medications": [{"id": "acetaminophen_500mg", "quantity": 26}],
        },
    )
    ci = client.post(
        "/api/v1/check-ins",
        json={"astronaut_id": "Crew B", "hr": 96, "sleep": 5.0, "bp": None, "symptoms": ["Headache"]},
    ).json()

    s = client.post("/api/v1/investigation/sessions", json={"astronaut_id": "Crew B", "check_in_id": ci["id"]}).json()
    step_answers = {
        "recent_exercise": ("no", None),
        "hydration_intake": ("adequate", None),
        "temperature_check": ("normal", 36.8),
        "sleep_environment": ("normal", None),
        "symptom_severity": ("moderate", None),
    }
    while s["status"] == "in_progress":
        curr = s["current_question"]["id"]
        val, num = step_answers[curr]
        payload = {"question_id": curr, "answer_value": val}
        if num is not None:
            payload["numeric_value"] = num
        s = client.post(f"/api/v1/investigation/sessions/{s['id']}/answer", json=payload).json()

    assert s["status"] == "completed"
    alloc = s["medication_allocation"]
    assert alloc["medication_id"] == "acetaminophen_500mg"
    assert alloc["crew_count"] == 5
    assert alloc["remaining_days"] == 60
    assert alloc["crew_safety_reserve"] == 24
    assert alloc["allocatable_pool"] == 2
    assert alloc["recommended_total_units"] == 2
    assert alloc["rationing_mode"] == "rationed"

    disp = client.post(f"/api/v1/investigation/sessions/{s['id']}/dispense")
    assert disp.status_code == 200
    assert disp.json()["dispensed"] is True
    assert disp.json()["dispensed_units"] == 2

    ctx = client.get("/api/v1/investigation/mission-context").json()
    acet = next(m for m in ctx["medications"] if m["id"] == "acetaminophen_500mg")
    assert acet["quantity"] == 24


def test_mild_headache_saves_medication(client):
    ci = client.post(
        "/api/v1/check-ins",
        json={"astronaut_id": "Crew A", "hr": 90, "sleep": 6.0, "bp": None, "symptoms": ["Headache"]},
    ).json()
    s = client.post("/api/v1/investigation/sessions", json={"astronaut_id": "Crew A", "check_in_id": ci["id"]}).json()

    step_answers = {
        "recent_exercise": "no",
        "hydration_intake": "adequate",
        "temperature_check": "normal",
        "sleep_environment": "normal",
        "symptom_severity": "mild",
    }
    while s["status"] == "in_progress":
        qid = s["current_question"]["id"]
        s = client.post(
            f"/api/v1/investigation/sessions/{s['id']}/answer",
            json={"question_id": qid, "answer_value": step_answers[qid]},
        ).json()

    assert s["status"] == "completed"
    assert s["medication_allocation"]["rationing_mode"] == "non_pharmacologic"
    assert s["medication_allocation"]["recommended_total_units"] == 0


def test_acute_fever_with_tight_reserve_still_allocates_and_includes_cotreatments(client):
    client.patch(
        "/api/v1/investigation/mission-context",
        json={
            "crew_count": 7,
            "remaining_days": 45,
            "medications": [{"id": "acetaminophen_500mg", "quantity": 15}],
        },
    )
    ci = client.post(
        "/api/v1/check-ins",
        json={"astronaut_id": "Crew A", "hr": 112, "sleep": 6.5, "bp": None, "symptoms": ["Dizziness", "Nausea"]},
    ).json()
    s = client.post("/api/v1/investigation/sessions", json={"astronaut_id": "Crew A", "check_in_id": ci["id"]}).json()

    answers = {
        "recent_exercise": "no",
        "hydration_intake": "low",
        "temperature_check": "elevated",
        "vestibular_trigger": "yes",
        "orthostatic_bp_check": "orthostatic",
        "symptom_severity": "moderate",
    }
    while s["status"] == "in_progress":
        qid = s["current_question"]["id"]
        s = client.post(
            f"/api/v1/investigation/sessions/{s['id']}/answer",
            json={"question_id": qid, "answer_value": answers[qid]},
        ).json()

    assert s["status"] == "completed"
    alloc = s["medication_allocation"]
    assert alloc["medication_id"] == "acetaminophen_500mg"
    assert alloc["recommended_total_units"] == 3
    assert alloc["rationing_mode"] == "rationed"
    sec_ids = [item["medication_id"] for item in s["secondary_allocations"]]
    assert "oral_rehydration_salts" in sec_ids
    assert any(m in sec_ids for m in ("ondansetron_8mg", "meclizine_25mg"))
    assert len(s["clinical_basis"]) >= 2

    # Dispense secondary co-treatment (ORS) cleanly
    disp_sec = client.post(
        f"/api/v1/investigation/sessions/{s['id']}/dispense",
        json={"medication_id": "oral_rehydration_salts"},
    )
    assert disp_sec.status_code == 200
    assert "oral_rehydration_salts" in disp_sec.json()["dispensed_secondary_ids"]
