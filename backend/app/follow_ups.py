"""Additive workflow-event routes. No medical decisions or report persistence."""
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import AstronautRow, CheckInRow, FollowUpRow
from .schemas import FollowUpCreate, FollowUpEvent


def dto(row):
    event = FollowUpEvent.model_validate(row)
    if event.recorded_at.tzinfo is None:
        event.recorded_at = event.recorded_at.replace(tzinfo=timezone.utc)
    return event


def require_pair(session, astronaut_id, check_in_id=None):
    if session.get(AstronautRow, astronaut_id) is None:
        raise HTTPException(404, "Astronaut not found")
    if check_in_id is not None:
        check_in = session.get(CheckInRow, check_in_id)
        if check_in is None:
            raise HTTPException(404, "Check-in not found")
        if check_in.astronaut_id != astronaut_id:
            raise HTTPException(422, "Check-in does not belong to astronaut")
        if not check_in.synthetic:
            raise HTTPException(422, "Follow-up requires a synthetic check-in")


def register_follow_ups(app, db):
    @app.post("/api/v1/follow-ups", response_model=FollowUpEvent, status_code=201)
    def create_follow_up(body: FollowUpCreate, session: Session = Depends(db)):
        # Validation and insert share a transaction; foreign keys also reject
        # nonexistent references. No check-in/seed/inventory row is updated.
        require_pair(session, body.astronaut_id, body.check_in_id)
        row = FollowUpRow(**body.model_dump(), id=str(uuid4()),
                          recorded_at=datetime.now(timezone.utc), synthetic=True,
                          provenance="User-recorded workflow event linked to synthetic check-in; no medical approval implied")
        session.add(row)
        session.commit()
        return dto(row)

    @app.get("/api/v1/astronauts/{astronaut_id}/follow-ups", response_model=list[FollowUpEvent])
    def follow_up_history(astronaut_id: str, check_in_id: str | None = Query(None, min_length=1, max_length=200),
                          limit: int = Query(100, ge=1, le=1000), offset: int = Query(0, ge=0),
                          session: Session = Depends(db)):
        require_pair(session, astronaut_id, check_in_id)
        query = select(FollowUpRow).where(FollowUpRow.astronaut_id == astronaut_id)
        if check_in_id is not None:
            query = query.where(FollowUpRow.check_in_id == check_in_id)
        rows = session.scalars(query.order_by(FollowUpRow.recorded_at, FollowUpRow.id).offset(offset).limit(limit))
        return [dto(row) for row in rows]
