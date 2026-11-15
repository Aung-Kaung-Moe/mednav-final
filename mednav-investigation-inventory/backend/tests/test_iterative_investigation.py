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
    assert s["status"] == "in_progress"
    assert s["current_question"]["id"] == "mission_duration_check"
    s = client.post(
        f"/api/v1/investigation/sessions/{s['id']}/answer",
        json={"question_id": "mission_duration_check", "answer_value": "45"},
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
        "mission_duration_check": ("45", 60),
        "hydration_intake": ("adequate", None),
        "temperature_check": ("normal", 36.8),
        "sleep_environment": ("normal", None),
        "symptom_severity": ("moderate", None),
    }
    asked = []
    while s["status"] == "in_progress":
        curr = s["current_question"]["id"]
        asked.append(curr)
        val, num = step_answers[curr]
        payload = {"question_id": curr, "answer_value": val}
        if num is not None:
            payload["numeric_value"] = num
        s = client.post(f"/api/v1/investigation/sessions/{s['id']}/answer", json=payload).json()

    assert "mission_duration_check" in asked
    assert 1 <= len(asked) <= 4
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
        "mission_duration_check": "45",
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
        "mission_duration_check": "45",
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
    for item in s["secondary_allocations"]:
        assert item["dosage_schedule"].startswith("If you have ")
        assert "take together" in item["dosage_schedule"]
        assert "Stop if you feel better." in item["dosage_schedule"]
    assert len(s["clinical_basis"]) >= 2

    # Dispense secondary co-treatment (ORS) cleanly
    disp_sec = client.post(
        f"/api/v1/investigation/sessions/{s['id']}/dispense",
        json={"medication_id": "oral_rehydration_salts"},
    )
    assert disp_sec.status_code == 200
    assert "oral_rehydration_salts" in disp_sec.json()["dispensed_secondary_ids"]


def test_proactive_tachycardia_cold_sweats_uses_offline_health_care_library(client):
    from app.iterative_investigation import _load_health_care_library, _load_preflight_baseline

    conditions, meds = _load_health_care_library()
    preflight = _load_preflight_baseline()
    assert "autonomic_tachycardia_diaphoresis" in conditions
    assert "oral_rehydration_salts" in meds
    assert "resting_heart_rate_bpm" in preflight
    assert "respiratory_rate_breaths_per_min" in preflight

    ci = client.post(
        "/api/v1/check-ins",
        json={"astronaut_id": "Crew A", "hr": 130, "sleep": 7.2, "bp": None, "symptoms": ["Headache", "Fatigue"]},
    ).json()

    # Multi-crew proactive screen identifies Crew A needing investigation
    alerts = client.get("/api/v1/investigation/crew-alerts").json()
    crew_a_alert = next(a for a in alerts if a["astronaut_id"] == "Crew A")
    assert crew_a_alert["needs_investigation"] is True
    assert crew_a_alert["urgent"] is True

    # Proactive latest-session lookup automatically opens a session for the abnormal check-in
    s = client.get("/api/v1/investigation/sessions/latest/Crew%20A").json()
    assert s["check_in_id"] == ci["id"]
    assert s["proactive_alert"] and "130 bpm" in s["proactive_alert"]
    assert s["status"] == "in_progress"

    step_answers = {
        "recent_exercise": "no",
        "mission_duration_check": "90",
        "sweating_autonomic_check": "yes",
        "hydration_intake": "low",
        "temperature_check": "normal",
        "sleep_environment": "normal",
        "symptom_severity": "moderate",
    }
    asked = []
    while s["status"] == "in_progress":
        qid = s["current_question"]["id"]
        asked.append(qid)
        s = client.post(
            f"/api/v1/investigation/sessions/{s['id']}/answer",
            json={"question_id": qid, "answer_value": step_answers[qid]},
        ).json()

    assert "sweating_autonomic_check" in asked
    assert "mission_duration_check" in asked
    assert 1 <= len(asked) <= 4
    assert s["status"] == "completed"
    assert s["mission_context"]["remaining_days"] == 90
    assert s["condition_id"] == "autonomic_tachycardia_diaphoresis"
    assert "Autonomic" in s["assessment_title"]
    assert s["medication_allocation"]["medication_id"] == "oral_rehydration_salts"
    assert any("health_care/" in item for item in s["clinical_basis"])


def test_normal_checkin_asks_no_investigation_questions(client):
    res = client.post(
        "/api/v1/check-ins",
        json={"astronaut_id": "Crew C", "hr": 72, "sleep": 7.5, "bp": "116 / 74", "symptoms": []},
    )
    assert res.status_code == 201
    ci = res.json()

    alerts = client.get("/api/v1/investigation/crew-alerts").json()
    assert not any(a["astronaut_id"] == "Crew C" and a["needs_investigation"] for a in alerts)

    s = client.post(
        "/api/v1/investigation/sessions",
        json={"astronaut_id": "Crew C", "check_in_id": ci["id"]},
    ).json()
    assert s["status"] == "completed"
    assert s["turn_count"] == 0


def test_random_checkin_visual_nausea_and_muscle_paths(client):
    # 1) Visual acuity change -> SANS ocular review + urgent alert
    res_vis = client.post(
        "/api/v1/check-ins",
        json={"astronaut_id": "Crew B", "hr": 74, "sleep": 7.0, "bp": "118 / 76", "symptoms": ["Visual acuity change", "Cephalad fluid fullness"]},
    )
    assert res_vis.status_code == 201
    alerts = client.get("/api/v1/investigation/crew-alerts").json()
    crew_b = next(a for a in alerts if a["astronaut_id"] == "Crew B")
    assert crew_b["urgent"] is True

    s_vis_res = client.get("/api/v1/investigation/sessions/latest/Crew%20B")
    assert s_vis_res.status_code == 200
    s_vis = s_vis_res.json()
    ans_vis = {
        "mission_duration_check": "45",
        "temperature_check": "normal",
        "symptom_severity": "mild",
        "hydration_intake": "adequate",
    }
    while s_vis["status"] == "in_progress":
        qid = s_vis["current_question"]["id"]
        step_res = client.post(
            f"/api/v1/investigation/sessions/{s_vis['id']}/answer",
            json={"question_id": qid, "answer_value": ans_vis[qid]},
        )
        assert step_res.status_code == 200, step_res.text
        s_vis = step_res.json()
    assert s_vis["condition_id"] == "sans_ocular_shift"

    # 2) Muscle discomfort with nausea -> blocks Ibuprofen and substitutes Acetaminophen
    res_mus = client.post(
        "/api/v1/check-ins",
        json={"astronaut_id": "Crew C", "hr": 74, "sleep": 7.0, "bp": "116 / 74", "symptoms": ["Muscle discomfort", "Nausea"]},
    )
    assert res_mus.status_code == 201
    s_mus_res = client.get("/api/v1/investigation/sessions/latest/Crew%20C")
    assert s_mus_res.status_code == 200
    s_mus = s_mus_res.json()
    ans_mus = {
        "recent_exercise": "no",
        "mission_duration_check": "45",
        "temperature_check": "normal",
        "vestibular_trigger": "no",
        "symptom_severity": "moderate",
        "hydration_intake": "adequate",
    }
    while s_mus["status"] == "in_progress":
        qid = s_mus["current_question"]["id"]
        step_res = client.post(
            f"/api/v1/investigation/sessions/{s_mus['id']}/answer",
            json={"question_id": qid, "answer_value": ans_mus[qid]},
        )
        assert step_res.status_code == 200, step_res.text
        s_mus = step_res.json()
    assert s_mus["status"] == "completed"
    assert s_mus["medication_allocation"]["medication_id"] != "ibuprofen_400mg"
    assert s_mus["current_question"] is None
    assert s_mus["condition_id"] in ("musculoskeletal_strain", "nausea_gi_support")
