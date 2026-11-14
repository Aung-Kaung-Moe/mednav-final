import sqlite3
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from app.main import create_app
from app.database import Base, FollowUpRow, create_database
from app.seed import seed


@pytest.fixture
def database(tmp_path):
    return tmp_path / "follow-ups.sqlite3"


@pytest.fixture
def client(database):
    with TestClient(create_app(f"sqlite:///{database.as_posix()}")) as client:
        yield client


def payload(**updates):
    return dict(astronaut_id="Crew A", check_in_id="demo-A-180", event_type="note_recorded", note="Synthetic review note", **updates)


def test_create_read_restart_without_modifying_check_ins(client, database):
    before = client.get("/api/v1/astronauts/Crew%20A/history").json()
    body = payload()
    response = client.post("/api/v1/follow-ups", json=body)
    assert response.status_code == 201
    event = response.json()
    assert event["id"] and event["recorded_at"].endswith("Z") and event["synthetic"] is True
    assert event["note"] == body["note"] and "no medical approval" in event["provenance"]
    assert client.get("/api/v1/astronauts/Crew%20A/history").json() == before
    with sqlite3.connect(database) as connection:
        assert connection.execute("SELECT note FROM follow_up_events WHERE id=?", (event["id"],)).fetchone()[0] == body["note"]
    with TestClient(create_app(f"sqlite:///{database.as_posix()}")) as restarted:
        assert restarted.get("/api/v1/astronauts/Crew%20A/follow-ups").json() == [event]


@pytest.mark.parametrize("event_type", ["review_requested", "note_recorded", "action_recorded"])
def test_types_order_filter_and_crew_isolation(client, event_type):
    created = client.post("/api/v1/follow-ups", json={**payload(), "event_type": event_type}).json()
    second = client.post("/api/v1/follow-ups", json={**payload(), "check_in_id": "demo-A-179", "event_type": "review_requested", "note": None}).json()
    rows = client.get("/api/v1/astronauts/Crew%20A/follow-ups").json()
    assert [row["id"] for row in rows] == [created["id"], second["id"]]
    assert client.get("/api/v1/astronauts/Crew%20B/follow-ups").json() == []
    assert client.get("/api/v1/astronauts/Crew%20A/follow-ups", params={"check_in_id": "demo-A-179"}).json() == [second]
    assert client.get("/api/v1/astronauts/Crew%20A/follow-ups", params={"offset": 1, "limit": 1}).json() == [second]


@pytest.mark.parametrize("change,status", [
    ({"astronaut_id": "missing"}, 404), ({"check_in_id": "missing"}, 404),
    ({"astronaut_id": "Crew B"}, 422), ({"event_type": "treated"}, 422),
    ({"note": " "}, 422), ({"note": None}, 422), ({"note": "x" * 2001}, 422),
    ({"note": 5}, 422), ({"recorded_at": "2026-01-01"}, 422), ({"check_in_id": ""}, 422),
])
def test_invalid_events_do_not_persist(client, change, status):
    response = client.post("/api/v1/follow-ups", json={**payload(), **change})
    assert response.status_code == status
    assert "detail" in response.json()
    assert client.get("/api/v1/astronauts/Crew%20A/follow-ups").json() == []
    detail = response.json()["detail"]
    if isinstance(detail, list):
        assert all("input" not in error for error in detail)


@pytest.mark.parametrize("path,params,status", [
    ("missing", {}, 404), ("Crew A", {"check_in_id": "missing"}, 404),
    ("Crew A", {"check_in_id": "demo-B-180"}, 422), ("Crew A", {"limit": 0}, 422),
])
def test_invalid_read_filters(client, path, params, status):
    assert client.get(f"/api/v1/astronauts/{path}/follow-ups", params=params).status_code == status


def test_additive_table_preserves_existing_seed(database):
    url = f"sqlite:///{database.as_posix()}"
    engine, sessions = create_database(url)
    Base.metadata.create_all(engine, tables=[table for table in Base.metadata.sorted_tables if table.name != "follow_up_events"])
    with sessions() as session:
        seed(session)
    engine.dispose()
    with sqlite3.connect(database) as connection:
        before = connection.execute("SELECT * FROM check_ins ORDER BY id").fetchall()
    with TestClient(create_app(url)) as client:
        assert client.post("/api/v1/follow-ups", json=payload()).status_code == 201
    with sqlite3.connect(database) as connection:
        assert connection.execute("SELECT * FROM check_ins ORDER BY id").fetchall() == before
        assert connection.execute("SELECT count(*) FROM follow_up_events").fetchone()[0] == 1


def test_sqlite_foreign_keys_reject_missing_reference(client):
    with client.app.state.sessions() as session:
        session.add(FollowUpRow(id="invalid", astronaut_id="Crew A", check_in_id="missing", event_type="review_requested",
                               note=None, recorded_at=datetime.now(timezone.utc), provenance="Synthetic invalid test", synthetic=True))
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()
    assert client.get("/api/v1/astronauts/Crew%20A/follow-ups").json() == []
