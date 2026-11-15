"""Scoped FastAPI endpoints for Investigation, Global Crew Alerts, and Medical Inventory."""

from contextlib import asynccontextmanager
import os
from pathlib import Path

from fastapi import Body, Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from .database import Base, InventoryRow, create_database
from .iterative_investigation import (
    CrewProactiveAlertDTO,
    DispenseRequest,
    InvestigationSessionDTO,
    MissionContextDTO,
    MissionContextUpdate,
    StartSessionRequest,
    SubmitAnswerRequest,
    build_mission_context_dto,
    dispense_session_allocation,
    get_all_crew_proactive_alerts,
    get_latest_session,
    reset_mission_context,
    start_investigation_session,
    submit_session_answer,
    update_mission_context,
)
from .schemas import InventoryItem, InventoryUpdate


def db(request: Request):
    with request.app.state.sessions() as session:
        yield session


def create_app(database_url: str | None = None):
    default_path = Path(__file__).resolve().parents[1] / "mednav.db"
    url = database_url or os.getenv("MEDNAV_DATABASE_URL", f"sqlite:///{default_path.as_posix()}")
    engine, sessions = create_database(url)

    @asynccontextmanager
    async def lifespan(app):
        Base.metadata.create_all(engine)
        try:
            yield
        finally:
            engine.dispose()

    app = FastAPI(title="MEDNAV Investigation & Inventory API", version="0.1.0", lifespan=lifespan, docs_url=None, redoc_url=None)
    app.state.sessions = sessions
    app.state.engine = engine
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
        allow_methods=["GET", "POST", "PATCH"],
        allow_headers=["Content-Type"],
    )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        return JSONResponse(
            status_code=422,
            content={"detail": [{"loc": list(error["loc"]), "msg": error["msg"], "type": error["type"]} for error in exc.errors()]},
        )

    @app.get("/api/v1/healthz")
    def healthz(session: Session = Depends(db)):
        session.execute(text("SELECT 1"))
        return {"status": "ok", "database": "sqlite"}

    @app.get("/api/v1/inventory", response_model=list[InventoryItem])
    def inventory(session: Session = Depends(db)):
        return list(session.scalars(select(InventoryRow).order_by(InventoryRow.name)))

    @app.patch("/api/v1/inventory/{name}", response_model=InventoryItem)
    def update_inventory(name: str, body: InventoryUpdate, session: Session = Depends(db)):
        row = session.get(InventoryRow, name)
        if row is None:
            raise HTTPException(404, "Inventory item not found")
        updates = body.model_dump(exclude_unset=True)
        quantity = updates.get("quantity", row.quantity)
        available = updates.get("available", row.available)
        if quantity == 0 and available:
            raise HTTPException(422, "Zero-quantity equipment cannot be available; set available=false")
        for key, value in updates.items():
            setattr(row, key, value)
        session.commit()
        return row

    @app.get("/api/v1/investigation/crew-alerts", response_model=list[CrewProactiveAlertDTO])
    def crew_alerts_route(session: Session = Depends(db)):
        return get_all_crew_proactive_alerts(session)

    @app.get("/api/v1/investigation/mission-context", response_model=MissionContextDTO)
    def get_mission_context(session: Session = Depends(db)):
        return build_mission_context_dto(session)

    @app.patch("/api/v1/investigation/mission-context", response_model=MissionContextDTO)
    def patch_mission_context(body: MissionContextUpdate, session: Session = Depends(db)):
        try:
            return update_mission_context(session, body)
        except LookupError as exc:
            raise HTTPException(404, str(exc)) from None

    @app.post("/api/v1/investigation/mission-context/reset", response_model=MissionContextDTO)
    def reset_mission_context_route(session: Session = Depends(db)):
        return reset_mission_context(session)

    @app.post("/api/v1/investigation/sessions", response_model=InvestigationSessionDTO, status_code=201)
    def start_session_route(body: StartSessionRequest, session: Session = Depends(db)):
        try:
            return start_investigation_session(session, body)
        except LookupError as exc:
            raise HTTPException(404, str(exc)) from None

    @app.get("/api/v1/investigation/sessions/latest/{astronaut_id}", response_model=InvestigationSessionDTO)
    def latest_session_route(astronaut_id: str, session: Session = Depends(db)):
        try:
            return get_latest_session(session, astronaut_id)
        except LookupError as exc:
            raise HTTPException(404, str(exc)) from None

    @app.post("/api/v1/investigation/sessions/{session_id}/answer", response_model=InvestigationSessionDTO)
    def answer_session_route(session_id: str, body: SubmitAnswerRequest, session: Session = Depends(db)):
        try:
            return submit_session_answer(session, session_id, body)
        except LookupError as exc:
            raise HTTPException(404, str(exc)) from None
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from None

    @app.post("/api/v1/investigation/sessions/{session_id}/dispense", response_model=InvestigationSessionDTO)
    def dispense_session_route(
        session_id: str,
        body: DispenseRequest | None = Body(default=None),
        session: Session = Depends(db),
    ):
        try:
            return dispense_session_allocation(
                session,
                session_id,
                medication_id=body.medication_id if body else None,
            )
        except LookupError as exc:
            raise HTTPException(404, str(exc)) from None
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from None

    return app


app = create_app()
