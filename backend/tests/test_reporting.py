from datetime import datetime, timezone
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import CheckInRow, InvestigationSessionRow, ReportVersionRow
from app.main import create_app


def test_pdf_queue_restart_and_simulated_acknowledgement(tmp_path, monkeypatch):
    monkeypatch.setenv("MEDNAV_OFFICER_KEY", "test-officer-secret")
    db = tmp_path / "report.sqlite3"
    reports = tmp_path / "pdfs"
    def client():
        return TestClient(create_app(f"sqlite:///{db.as_posix()}", report_dir=reports))
    with client() as api:
        created = api.post("/api/v1/reports", json={"astronaut_id": "Crew A"})
        assert created.status_code == 201, created.text
        report = created.json()
        assert report["snapshot"]["timezone"] == "UTC"
        assert len(report["snapshot"]["days"]) == 7
        assert report["snapshot"]["medications"] == []
        assert api.post(f"/api/v1/reports/{report['id']}/queue").status_code == 403
        pdf = api.get(f"/api/v1/reports/{report['id']}/pdf")
        assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
        assert api.post(f"/api/v1/reports/{report['id']}/queue", headers={"X-MEDNAV-Officer-Key": "test-officer-secret"}).status_code == 409
        reviewed = api.post(f"/api/v1/reports/{report['id']}/reviews", headers={"X-MEDNAV-Officer-Key": "test-officer-secret"}, json={
            "reviewer": "Demo officer", "outcome": "Reviewed / Closed", "notes": "Synthetic review only",
            "checklist_reviewed": True}).json()
        assert reviewed["version"] == 2
        queued = api.post(f"/api/v1/reports/{report['id']}/queue", headers={"X-MEDNAV-Officer-Key": "test-officer-secret"})
        assert queued.status_code == 200 and queued.json()["status"] == "PENDING_TRANSMISSION"
        assert api.get("/api/v1/earth/received").json() == []
    with client() as api:
        resumed = api.get(f"/api/v1/reports/{report['id']}").json()
        assert resumed["status"] == "PENDING_TRANSMISSION"
        assert api.get(f"/api/v1/reports/{report['id']}/pdf?version=2").content.startswith(b"%PDF")
        online = api.post("/api/v1/earth/status", headers={"X-MEDNAV-Officer-Key": "test-officer-secret"}, json={"online": True})
        assert online.status_code == 200, online.text
        delivered = api.get(f"/api/v1/reports/{report['id']}").json()
        assert delivered["status"] == "DELIVERED" and delivered["receipt_id"]
        received = api.get("/api/v1/earth/received").json()
        assert len(received) == 1 and received[0]["sha256"] == delivered["sha256"]
        api.post("/api/v1/earth/status", headers={"X-MEDNAV-Officer-Key": "test-officer-secret"}, json={"online": True})
        assert len(api.get("/api/v1/earth/received").json()) == 1


def test_weekly_window_missing_values_and_documented_medicine_only(tmp_path, monkeypatch):
    monkeypatch.setenv("MEDNAV_OFFICER_KEY", "test-officer-secret")
    app = create_app(f"sqlite:///{(tmp_path / 'weekly.sqlite3').as_posix()}", report_dir=tmp_path / "pdfs")
    with TestClient(app) as api:
        with app.state.sessions() as session:
            old = session.get(CheckInRow, "demo-A-180")
            if old:
                old.recorded_at = datetime(2020, 1, 1, tzinfo=timezone.utc)
                session.commit()
        made = api.post("/api/v1/check-ins", json={"astronaut_id": "Crew A", "hr": None, "sleep": 4.5, "bp": None, "symptoms": ["Headache", "Future-only fatigue marker d252b1fa-f545-446e-ba95-fce67dfff3e4"]})
        assert made.status_code == 201
        preview = api.get("/api/v1/reports/preview", params={"astronaut_id": "Crew A"})
        assert preview.status_code == 200
        assert api.get("/api/v1/reports", params={"astronaut_id": "Crew A"}).json() == []
        assert preview.json()["measurements"][-1]["sleep"] == 4.5
        assert [item["name"] for item in preview.json()["symptoms"]] == ["Headache"]
        report = api.post("/api/v1/reports", json={"astronaut_id": "Crew A"}).json()
        snapshot = report["snapshot"]
        assert any(r["id"] == made.json()["id"] and r["hr"] is None for r in snapshot["measurements"])
        assert snapshot["symptoms"][-1]["name"] == "Headache"
        assert snapshot["medications"] == []
        assert any(v is None for v in snapshot["daily"]["hr"])
        assert all(r["recorded_at"] >= snapshot["period_start"] for r in snapshot["measurements"])
        assert api.post("/api/v1/medication-administrations", json={"astronaut_id": "Crew A", "medication_name": "Aspirin", "status": "taken", "source": "Manual", "recorded_by": "Demo", "confirmed": True}, headers={"X-MEDNAV-Officer-Key": "test-officer-secret"}).status_code == 422


def test_corrupt_pdf_stays_undelivered(tmp_path, monkeypatch):
    monkeypatch.setenv("MEDNAV_OFFICER_KEY", "test-officer-secret")
    app = create_app(f"sqlite:///{(tmp_path / 'corrupt.sqlite3').as_posix()}", report_dir=tmp_path / "pdfs")
    headers = {"X-MEDNAV-Officer-Key": "test-officer-secret"}
    with TestClient(app) as api:
        report = api.post("/api/v1/reports", json={"astronaut_id": "Crew A"}).json()
        reviewed = api.post(f"/api/v1/reports/{report['id']}/reviews", headers=headers, json={
            "reviewer": "Demo officer", "outcome": "Reviewed / Closed", "notes": "Synthetic review",
            "checklist_reviewed": True}).json()
        queued = api.post(f"/api/v1/reports/{report['id']}/queue", headers=headers)
        assert queued.json()["status"] == "PENDING_TRANSMISSION"
        with app.state.sessions() as session:
            version = session.query(ReportVersionRow).filter_by(report_id=report["id"], version=reviewed["version"]).one()
            Path(version.pdf_path).write_bytes(b"corrupt")
        api.post("/api/v1/earth/status", headers=headers, json={"online": True})
        current = api.get(f"/api/v1/reports/{report['id']}").json()
        assert current["status"] == "RETRY_PENDING"
        assert current["acknowledged_at"] is None
        assert api.get("/api/v1/earth/received").json() == []
        assert api.get(f"/api/v1/reports/{report['id']}/pdf").status_code == 409


def test_earlier_confirmed_investigation_deduction_is_recovered_once(tmp_path):
    db = tmp_path / "history.sqlite3"
    def app():
        return create_app(f"sqlite:///{db.as_posix()}", report_dir=tmp_path / "pdfs")
    first = app()
    with TestClient(first):
        with first.state.sessions() as session:
            session.add(InvestigationSessionRow(
                id="earlier-take", astronaut_id="Crew A", check_in_id="demo-A-180",
                created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
                status="completed", communication_mode="offline", answers={}, turns=[],
                dispensed=True, dispensed_medication_id="melatonin_3mg", dispensed_units=3,
            ))
            session.commit()
    for _ in range(2):
        with TestClient(app()) as api:
            medicines = api.get("/api/v1/reports/preview", params={"astronaut_id": "Crew A"}).json()["medications"]
            recovered = [item for item in medicines if item["incident_id"] == "earlier-take"]
            assert len(recovered) == 1
            assert recovered[0]["astronaut_id"] == "Crew A"
            assert recovered[0]["dose"] == "3 tablets"
            assert recovered[0]["taken_at"] is None
